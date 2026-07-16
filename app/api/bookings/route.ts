import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ok, fail, handler, ApiError } from '@/lib/server/http';
import { rateLimit, RATE_LIMITS } from '@/lib/server/rateLimit';
import { parseBody } from '@/lib/server/validation';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { computeQuote } from '@/lib/server/pricing';

export const runtime = 'nodejs';
// Session cookie read → never statically prerenderable.
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  propertyId: z.string().min(1),
  serviceTypeKey: z.string().min(1),
  addons: z.array(z.object({ key: z.string().min(1), qty: z.number().int().min(0).max(100) })).default([]),
  scheduledAt: z.coerce.date(),
  paymentMethod: z.enum(['card', 'cash']),
  recurring: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
});

function randomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `TT-${s}`;
}

/**
 * POST /api/bookings (§10) — create the DRAFT at the end of wizard steps 1–3.
 * Server reprices from scratch (§6: client totals are never trusted). No
 * cleaner is chosen yet, so the stored money columns are the **range-maximum
 * (provisional ceiling)** — schema requires non-null amounts, and the ceiling
 * is the only number that can never surprise the customer upward. The exact
 * reprice happens when a cleaner is attached (direct select / E3.6 accept);
 * `pricing_snapshot.kind = 'range'` records both bounds for that step.
 * A recurring choice also creates the RecurringPlan (generator = E3.10).
 */
export const POST = handler(async (request: Request) => {
  const user = await requireDbUser(await requireSession());
  const { allowed, retryAfterSec } = rateLimit(`booking:${user.id}`, RATE_LIMITS.booking);
  if (!allowed) return fail('RATE_LIMITED', 429, { retryAfterSec });
  const body = await parseBody(request, bodySchema);

  const property = await prisma.property.findFirst({
    where: { id: body.propertyId, ownerId: user.id },
    include: { city: true },
  });
  if (!property) throw new ApiError('PROPERTY_NOT_FOUND', 404);
  if (!property.city) throw new ApiError('PROPERTY_CITY_REQUIRED', 409);
  if (!property.sizeM2) throw new ApiError('PROPERTY_SIZE_REQUIRED', 409);
  if (body.scheduledAt.getTime() < Date.now()) throw new ApiError('SCHEDULED_IN_PAST', 400);

  const quote = await computeQuote({
    citySlug: property.city.slug,
    serviceTypeKey: body.serviceTypeKey,
    m2: property.sizeM2,
    addons: body.addons,
    paymentMethod: body.paymentMethod,
    recurring: body.recurring,
  });
  if (quote.kind !== 'range') throw new ApiError('INTERNAL_ERROR', 500); // no rateF was passed
  const ceiling = quote.max;

  const serviceType = await prisma.serviceType.findUniqueOrThrow({
    where: { key: body.serviceTypeKey },
  });
  const addonRows = await prisma.addon.findMany({
    where: { key: { in: body.addons.map((a) => a.key) } },
  });
  const addonByKey = new Map(addonRows.map((a) => [a.key, a]));

  const recurringPlan = body.recurring
    ? await prisma.recurringPlan.create({
        data: {
          customerId: user.id,
          propertyId: property.id,
          frequency: body.recurring,
          weekday: body.scheduledAt.getUTCDay(),
          time: body.scheduledAt.toISOString().slice(11, 16),
          nextRunDate: body.scheduledAt,
          serviceTypeId: serviceType.id,
          addonsTemplate: body.addons,
        },
      })
    : null;

  // Retry the human-readable code on the (unlikely) unique collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const booking = await prisma.booking.create({
        data: {
          code: randomCode(),
          customerId: user.id,
          propertyId: property.id,
          serviceTypeId: serviceType.id,
          scheduledAt: body.scheduledAt,
          slotMinutes: Math.ceil(ceiling.estHours * 60),
          recurringPlanId: recurringPlan?.id,
          estHours: ceiling.estHours,
          cleanerRateF: ceiling.rateF,
          cleanerAmountF: ceiling.cleanerAmountF,
          serviceFeeF: ceiling.serviceFeeF,
          cashFeeF: ceiling.cashFeeF,
          discountF: ceiling.discountF,
          totalF: ceiling.totalF,
          paymentMethod: body.paymentMethod,
          pricingSnapshot: {
            kind: 'range',
            min: quote.min,
            max: quote.max,
          } as unknown as Prisma.InputJsonValue,
          pricingConfigVersion: ceiling.pricingConfigVersion,
          matchingMode: 'broadcast',
          engagementModel: 'marketplace',
          addons: {
            create: body.addons
              .filter((a) => a.qty > 0)
              .map((a) => {
                const row = addonByKey.get(a.key);
                if (!row) throw new ApiError('ADDON_NOT_FOUND', 404, { key: a.key });
                return {
                  addonId: row.id,
                  qty: a.qty,
                  hoursSnapshot: row.hours,
                  priceFSnapshot: Math.round(row.hours * a.qty * ceiling.rateF),
                };
              }),
          },
        },
        include: { addons: true, recurringPlan: true },
      });
      return ok({ booking }, { status: 201 });
    } catch (err) {
      const isCodeCollision =
        typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
      if (!isCodeCollision || attempt === 2) throw err;
    }
  }
  throw new ApiError('INTERNAL_ERROR', 500);
});

/** GET /api/bookings — the caller's bookings, newest first (list UI = E3.9). */
export const GET = handler(async () => {
  const user = await requireDbUser(await requireSession());
  const bookings = await prisma.booking.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { serviceType: { select: { key: true, nameBs: true, nameEn: true } }, property: { select: { label: true, street: true } } },
  });
  return ok({ bookings });
});
