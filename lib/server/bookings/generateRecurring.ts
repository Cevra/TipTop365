import 'server-only';
import { prisma } from '@/lib/server/db';
import { computeQuote } from '@/lib/server/pricing';
import { isDue, nextRunDate } from '@/lib/domain/recurring';

// Daily materializer (E3.10, §5 note): every active plan whose nextRunDate is
// within 14 days gets ONE bookings row per due occurrence, then the plan
// advances. Idempotent two ways: (recurringPlanId, scheduledAt) is checked
// before insert, and the plan's own nextRunDate only moves forward — a crashed
// run resumes exactly where it stopped.

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `TT-${s}`;
}

export async function generateRecurringBookings(now = new Date()) {
  const plans = await prisma.recurringPlan.findMany({
    where: { active: true },
    include: { property: { include: { city: true } }, serviceType: true },
  });

  let created = 0;
  let skipped = 0;
  const errors: { planId: string; reason: string }[] = [];

  for (const plan of plans) {
    // A plan may have several due occurrences (e.g. job was down) — cap the
    // loop defensively so a corrupt nextRunDate can't spin forever.
    for (let hop = 0; hop < 8 && isDue(plan.nextRunDate, now); hop++) {
      const scheduledAt = plan.nextRunDate;
      try {
        if (!plan.property.city || !plan.property.sizeM2) {
          errors.push({ planId: plan.id, reason: 'PROPERTY_INCOMPLETE' });
          break;
        }
        const addons = Array.isArray(plan.addonsTemplate)
          ? (plan.addonsTemplate as { key: string; qty: number }[])
          : [];

        const exists = await prisma.booking.findFirst({
          where: { recurringPlanId: plan.id, scheduledAt },
          select: { id: true },
        });
        if (!exists) {
          const quote = await computeQuote({
            citySlug: plan.property.city.slug,
            serviceTypeKey: plan.serviceType.key,
            m2: plan.property.sizeM2,
            addons,
            paymentMethod: 'card',
            recurring: plan.frequency,
          });
          if (quote.kind !== 'range') throw new Error('expected range quote');
          const ceiling = quote.max;

          const addonRows = await prisma.addon.findMany({
            where: { key: { in: addons.map((a) => a.key) } },
          });
          const addonByKey = new Map(addonRows.map((a) => [a.key, a]));

          await prisma.booking.create({
            data: {
              code: randomCode(),
              customerId: plan.customerId,
              propertyId: plan.propertyId,
              serviceTypeId: plan.serviceTypeId,
              // Preferred cleaner (template field) becomes a direct offer in
              // E4.2's flow; the generated draft stays broadcast for now.
              scheduledAt,
              slotMinutes: Math.ceil(ceiling.estHours * 60),
              recurringPlanId: plan.id,
              estHours: ceiling.estHours,
              cleanerRateF: ceiling.rateF,
              cleanerAmountF: ceiling.cleanerAmountF,
              serviceFeeF: ceiling.serviceFeeF,
              cashFeeF: ceiling.cashFeeF,
              discountF: ceiling.discountF,
              totalF: ceiling.totalF,
              paymentMethod: 'card',
              pricingSnapshot: JSON.parse(
                JSON.stringify({ kind: 'range', min: quote.min, max: quote.max }),
              ),
              pricingConfigVersion: ceiling.pricingConfigVersion,
              matchingMode: 'broadcast',
              engagementModel: 'marketplace',
              addons: {
                create: addons
                  .filter((a) => a.qty > 0 && addonByKey.has(a.key))
                  .map((a) => ({
                    addonId: addonByKey.get(a.key)!.id,
                    qty: a.qty,
                    hoursSnapshot: addonByKey.get(a.key)!.hours,
                    priceFSnapshot: Math.round(addonByKey.get(a.key)!.hours * a.qty * ceiling.rateF),
                  })),
              },
            },
          });
          created++;
        } else {
          skipped++;
        }

        plan.nextRunDate = nextRunDate(plan.frequency, scheduledAt);
        await prisma.recurringPlan.update({
          where: { id: plan.id },
          data: { nextRunDate: plan.nextRunDate },
        });
      } catch (err) {
        errors.push({ planId: plan.id, reason: err instanceof Error ? err.message : 'unknown' });
        break; // never advance past a failed occurrence
      }
    }
  }
  return { plans: plans.length, created, skipped, errors };
}
