import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { dashboardMetrics } from '@/lib/server/adminMetrics';

// Integration (E9.2): metric aggregation math against controlled fixtures.
// Other suites' rows exist too — assertions are delta-based, not absolute.

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('dashboardMetrics (E9.2)', () => {
  it('counts fixtures into the right buckets with fening-exact sums', async () => {
    const before = await dashboardMetrics(30);

    const serviceType = await prisma.serviceType.findFirstOrThrow({ where: { key: 'standard' } });
    const user = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-met`,
        email: `met-${stamp}@test.local`,
        properties: { create: { street: 'Met', houseNo: '1' } },
      },
      include: { properties: true },
    });
    const base = {
      customerId: user.id,
      propertyId: user.properties[0].id,
      serviceTypeId: serviceType.id,
      scheduledAt: new Date(),
      slotMinutes: 120,
      estHours: 2,
      cleanerRateF: 1000,
      cleanerAmountF: 2000,
      serviceFeeF: 400,
      cashFeeF: 0,
      discountF: 0,
      totalF: 2400,
      paymentMethod: 'card' as const,
      pricingSnapshot: {},
      pricingConfigVersion: 1,
      matchingMode: 'direct' as const,
      engagementModel: 'marketplace' as const,
    };
    await prisma.booking.createMany({
      data: [
        { ...base, code: `TT-${stamp}-M1`, status: 'completed' },
        { ...base, code: `TT-${stamp}-M2`, status: 'completed', cashFeeF: 200, totalF: 2600 },
        { ...base, code: `TT-${stamp}-M3`, status: 'cancelled' },
        { ...base, code: `TT-${stamp}-M4`, status: 'matching' },
      ],
    });

    const after = await dashboardMetrics(30);
    expect(after.bookingsCreated - before.bookingsCreated).toBe(4);
    expect(after.bookingsCompleted - before.bookingsCompleted).toBe(2);
    expect(after.bookingsCancelled - before.bookingsCancelled).toBe(1);
    expect(after.bookingsOpen - before.bookingsOpen).toBe(1);
    expect(after.gmvF - before.gmvF).toBe(5000); // 2400 + 2600
    expect(after.commissionF - before.commissionF).toBe(1000); // 400 + 400 + 200 cash fee
    expect(after.activeCleaners).toBeGreaterThanOrEqual(6); // seed roster
    expect(after.verifiedCleaners).toBeGreaterThanOrEqual(4);
    expect(after.conversionPct === null || (after.conversionPct >= 0 && after.conversionPct <= 100)).toBe(true);
  });
});
