import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { post } from '@/lib/server/ledger/engine';
import { releasePlan, topupPlan } from '@/lib/domain/ledger/postings';
import { walletStatus, isCleanerBlocked } from '@/lib/server/wallet';
import { acceptOffer, broadcastOffers } from '@/lib/server/bookings/broadcast';

// Integration (E5.3): the Bolt/Uber cash loop — commission debt accumulates,
// the block engages below the city limit, a top-up unblocks acceptance.

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

afterAll(async () => {
  await prisma.ledgerEntry.deleteMany({ where: { txId: { contains: stamp } } });
  await prisma.bookingOffer.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.bookingEvent.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.walletAccount.deleteMany({
    where: { ownerId: { in: (await prisma.cleanerProfile.findMany({ where: { user: { email: { contains: stamp } } }, select: { id: true } })).map((c) => c.id) } },
  });
  await prisma.cleanerService.deleteMany({ where: { cleanerProfile: { user: { email: { contains: stamp } } } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('cash wallet loop (E5.3, §7)', () => {
  it('debt below the −50 KM limit blocks acceptance; top-up unblocks it', async () => {
    const sarajevo = await prisma.city.findUniqueOrThrow({ where: { slug: 'sarajevo' } });
    const standard = await prisma.serviceType.findUniqueOrThrow({ where: { key: 'standard' } });

    const cleanerUser = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-cw`,
        email: `cw-${stamp}@test.local`,
        role: 'cleaner',
        cleanerProfile: {
          create: {
            tier: 'verified',
            hourlyRateF: 1000,
            cityId: sarajevo.id,
            services: { create: [{ serviceTypeId: standard.id }] },
          },
        },
      },
      include: { cleanerProfile: true },
    });
    const cleanerId = cleanerUser.cleanerProfile!.id;

    // Two cash jobs' commissions: 2 × 2 600 f = 5 200 f debt → net −5 200 < −5 000.
    const money = {
      id: `x`, // replaced per call below
      cleanerId,
      cleanerAmountF: 13000,
      serviceFeeF: 2600,
      cashFeeF: 0,
      discountF: 0,
      totalF: 15600,
      paymentMethod: 'cash' as const,
    };
    // Ledger entries require a real booking for the FK — one carrier booking.
    const customer = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-cwc`,
        email: `cwc-${stamp}@test.local`,
        properties: { create: { street: 'CW', houseNo: '1', sizeM2: 75, cityId: sarajevo.id } },
      },
      include: { properties: true },
    });
    const carrier = await prisma.booking.create({
      data: {
        code: `TT-${stamp}-CW1`,
        customerId: customer.id,
        propertyId: customer.properties[0].id,
        cleanerId,
        serviceTypeId: standard.id,
        status: 'completed',
        scheduledAt: new Date(),
        slotMinutes: 240,
        estHours: 4,
        cleanerRateF: 1000,
        cleanerAmountF: 13000,
        serviceFeeF: 2600,
        cashFeeF: 0,
        discountF: 0,
        totalF: 15600,
        paymentMethod: 'cash',
        pricingSnapshot: {},
        pricingConfigVersion: 1,
        matchingMode: 'direct',
        engagementModel: 'marketplace',
      },
    });
    await post({ ...releasePlan({ ...money, id: carrier.id }), idempotencyKey: `release:${stamp}-1`, bookingId: carrier.id });
    await post({ ...releasePlan({ ...money, id: carrier.id }), idempotencyKey: `release:${stamp}-2`, bookingId: carrier.id });

    const status = await walletStatus(cleanerId);
    expect(status.receivableF).toBe(5200);
    expect(status.netF).toBe(-5200);
    expect(status.limitF).toBe(-5000);
    expect(status.blocked).toBe(true);
    expect(await isCleanerBlocked(cleanerId)).toBe(true);

    // A fresh matching booking broadcast to this cleaner — accept is rejected.
    const target = await prisma.booking.create({
      data: {
        code: `TT-${stamp}-CW2`,
        customerId: customer.id,
        propertyId: customer.properties[0].id,
        serviceTypeId: standard.id,
        status: 'matching',
        scheduledAt: new Date(Date.now() + 3 * 86_400_000),
        slotMinutes: 180,
        estHours: 3,
        cleanerRateF: 1500,
        cleanerAmountF: 4500,
        serviceFeeF: 900,
        cashFeeF: 0,
        discountF: 0,
        totalF: 5400,
        paymentMethod: 'card',
        pricingSnapshot: {},
        pricingConfigVersion: 1,
        matchingMode: 'broadcast',
        engagementModel: 'marketplace',
      },
    });
    await broadcastOffers(target.id);
    const offer = await prisma.bookingOffer.findFirstOrThrow({
      where: { bookingId: target.id, cleanerId },
    });
    await expect(acceptOffer(offer.id, cleanerUser.id)).rejects.toMatchObject({
      code: 'CLEANER_BLOCKED_NEGATIVE_BALANCE',
    });

    // Top-up 3 KM → net −4 900, above the limit again → accept succeeds.
    await post({ ...topupPlan(cleanerId, 300, `${stamp}-tp`), idempotencyKey: `topup:${stamp}-tp` });
    expect((await walletStatus(cleanerId)).blocked).toBe(false);
    const booking = await acceptOffer(offer.id, cleanerUser.id);
    expect(booking.status).toBe('accepted');
    expect(booking.cleanerId).toBe(cleanerId);
  });
});
