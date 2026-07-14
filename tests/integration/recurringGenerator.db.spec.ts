import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { generateRecurringBookings } from '@/lib/server/bookings/generateRecurring';

// Integration (E3.10): the daily materializer against real Postgres —
// creates due drafts, advances plans, double-run is a no-op.

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

afterAll(async () => {
  await prisma.bookingAddon.deleteMany({ where: { booking: { customer: { email: { contains: stamp } } } } });
  await prisma.booking.deleteMany({ where: { customer: { email: { contains: stamp } } } });
  await prisma.recurringPlan.deleteMany({ where: { customer: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('generateRecurringBookings', () => {
  it('materializes due plans 14 days ahead, idempotently, with the recurring discount', async () => {
    const sarajevo = await prisma.city.findUniqueOrThrow({ where: { slug: 'sarajevo' } });
    const standard = await prisma.serviceType.findUniqueOrThrow({ where: { key: 'standard' } });
    const inTenDays = new Date(Date.now() + 10 * 86_400_000);

    const user = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-rec`,
        email: `rec-${stamp}@test.local`,
        properties: { create: { street: 'Rec', houseNo: '1', sizeM2: 60, cityId: sarajevo.id } },
      },
      include: { properties: true },
    });
    const plan = await prisma.recurringPlan.create({
      data: {
        customerId: user.id,
        propertyId: user.properties[0].id,
        frequency: 'weekly',
        time: '10:00',
        nextRunDate: inTenDays,
        serviceTypeId: standard.id,
        addonsTemplate: [{ key: 'fridge', qty: 1 }],
      },
    });

    const first = await generateRecurringBookings();
    expect(first.errors.filter((e) => e.planId === plan.id)).toHaveLength(0);

    const drafts = await prisma.booking.findMany({
      where: { recurringPlanId: plan.id },
      include: { addons: true },
      orderBy: { scheduledAt: 'asc' },
    });
    // 10 days out is due; the advanced occurrence (+7 d = 17 d out) is beyond
    // the horizon, so exactly one draft materializes.
    expect(drafts).toHaveLength(1);
    expect(drafts[0].status).toBe('draft');
    expect(drafts[0].scheduledAt.getTime()).toBe(inTenDays.getTime());
    expect(drafts[0].addons).toHaveLength(1);
    // 60 m² standard + fridge (0.5 h) = 3 h; weekly −10 % on the 1500 ceiling:
    // 4500 − 450 = 4050 + 20 % fee 810 = 4860.
    expect(drafts[0].discountF).toBe(450);
    expect(drafts[0].totalF).toBe(4860);

    const advanced = await prisma.recurringPlan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(advanced.nextRunDate.getTime()).toBe(inTenDays.getTime() + 7 * 86_400_000);

    // Double-run: nothing new (the advanced date is outside the horizon).
    const second = await generateRecurringBookings();
    expect(await prisma.booking.count({ where: { recurringPlanId: plan.id } })).toBe(1);
    expect(second.errors.filter((e) => e.planId === plan.id)).toHaveLength(0);
  });

  it('skips incomplete properties with a reported error, never advancing the plan', async () => {
    const standard = await prisma.serviceType.findUniqueOrThrow({ where: { key: 'standard' } });
    const user = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-bad`,
        email: `rec-bad-${stamp}@test.local`,
        properties: { create: { street: 'NoCity', houseNo: '2', sizeM2: 50 } }, // no city
      },
      include: { properties: true },
    });
    const due = new Date(Date.now() + 3 * 86_400_000);
    const plan = await prisma.recurringPlan.create({
      data: {
        customerId: user.id,
        propertyId: user.properties[0].id,
        frequency: 'weekly',
        time: '09:00',
        nextRunDate: due,
        serviceTypeId: standard.id,
      },
    });

    const result = await generateRecurringBookings();
    expect(result.errors.some((e) => e.planId === plan.id && e.reason === 'PROPERTY_INCOMPLETE')).toBe(true);
    expect(await prisma.booking.count({ where: { recurringPlanId: plan.id } })).toBe(0);
    const after = await prisma.recurringPlan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(after.nextRunDate.getTime()).toBe(due.getTime()); // not advanced
  });
});
