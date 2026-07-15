import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { checkDayLimit, recordWorkDay } from '@/lib/server/dayLimits';

// Integration (E7.3): recordWorkDay idempotency against the DB unique
// constraint + checkDayLimit against real rows (incl. regime switch).

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

async function fixture() {
  const serviceType = await prisma.serviceType.findFirstOrThrow({ where: { key: 'standard' } });
  const customer = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-dl-c`,
      email: `dl-c-${stamp}@test.local`,
      properties: { create: { street: 'DL', houseNo: '1' } },
    },
    include: { properties: true },
  });
  const cleaner = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-dl-w`,
      email: `dl-w-${stamp}@test.local`,
      role: 'cleaner',
      cleanerProfile: { create: {} },
    },
    include: { cleanerProfile: true },
  });
  const booking = await prisma.booking.create({
    data: {
      code: `TT-${stamp}-DL`,
      customerId: customer.id,
      propertyId: customer.properties[0].id,
      cleanerId: cleaner.cleanerProfile!.id,
      serviceTypeId: serviceType.id,
      scheduledAt: new Date('2026-09-01T10:00:00.000Z'),
      slotMinutes: 120,
      estHours: 2,
      cleanerRateF: 1000,
      cleanerAmountF: 2000,
      serviceFeeF: 400,
      cashFeeF: 0,
      discountF: 0,
      totalF: 2400,
      paymentMethod: 'card',
      pricingSnapshot: {},
      pricingConfigVersion: 1,
      matchingMode: 'direct',
      engagementModel: 'marketplace',
    },
  });
  return { cleanerProfileId: cleaner.cleanerProfile!.id, bookingId: booking.id };
}

afterAll(async () => {
  await prisma.dayLimitEntry.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('day limits (E7.3)', () => {
  it('records a day once — the second visit that day is not counted', async () => {
    const { cleanerProfileId, bookingId } = await fixture();

    const first = await recordWorkDay({
      cleanerId: cleanerProfileId,
      bookingId,
      workDate: new Date('2026-09-01T08:00:00.000Z'),
      regime: 'fbih',
    });
    expect(first.counted).toBe(true);

    const sameDay = await recordWorkDay({
      cleanerId: cleanerProfileId,
      bookingId,
      workDate: new Date('2026-09-01T16:30:00.000Z'), // afternoon visit
      regime: 'fbih',
    });
    expect(sameDay.counted).toBe(false);

    const nextDay = await recordWorkDay({
      cleanerId: cleanerProfileId,
      bookingId,
      workDate: new Date('2026-09-02T08:00:00.000Z'),
      regime: 'fbih',
    });
    expect(nextDay.counted).toBe(true);

    const status = await checkDayLimit(cleanerProfileId, 'fbih', 2026);
    expect(status.used).toBe(2);
    expect(status.limit).toBe(60);
    expect(status.blocked).toBe(false);

    // Regime switch mid-year: days already worked still count (conservative) —
    // the student limit is just evaluated against the same used total.
    const asStudent = await checkDayLimit(cleanerProfileId, 'fbih_student', 2026);
    expect(asStudent.used).toBe(2);
    expect(asStudent.limit).toBe(180);
  });
});
