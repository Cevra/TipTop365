import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { acceptOffer, broadcastOffers, expireMatching } from '@/lib/server/bookings/broadcast';

// Integration (E3.6): offer broadcast, RACE-SAFE first-accept (G3), exact
// reprice on accept, expiry job. Drives the lib layer directly — the route
// handlers are thin wrappers over these functions.

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

async function fixture(suffix: string, opts?: { scheduledAt?: Date }) {
  const sarajevo = await prisma.city.findUniqueOrThrow({ where: { slug: 'sarajevo' } });
  const standard = await prisma.serviceType.findUniqueOrThrow({ where: { key: 'standard' } });

  const customer = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-${suffix}-cust`,
      email: `bc-${suffix}-${stamp}@test.local`,
      properties: {
        create: { street: 'Broadcast', houseNo: suffix, sizeM2: 75, cityId: sarajevo.id },
      },
    },
    include: { properties: true },
  });

  // Three verified cleaners with distinct rates, offering `standard`.
  // NOTE: the seed's Sarajevo roster is ALSO eligible — assertions below
  // always scope to these fixture cleaners rather than exact totals.
  const cleaners = [];
  const rates = [1000, 1200, 1400];
  for (let i = 0; i < rates.length; i++) {
    const rateF = rates[i];
    const u = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-${suffix}-cl${i}`,
        email: `bc-cl${i}-${suffix}-${stamp}@test.local`,
        role: 'cleaner',
        cleanerProfile: {
          create: {
            tier: 'verified',
            hourlyRateF: rateF,
            cityId: sarajevo.id,
            services: { create: [{ serviceTypeId: standard.id }] },
          },
        },
      },
      include: { cleanerProfile: true },
    });
    cleaners.push(u);
  }

  const booking = await prisma.booking.create({
    data: {
      code: `TT-${stamp}-${suffix}`,
      customerId: customer.id,
      propertyId: customer.properties[0].id,
      serviceTypeId: standard.id,
      status: 'matching',
      scheduledAt: opts?.scheduledAt ?? new Date(Date.now() + 3 * 24 * 3600_000),
      slotMinutes: 180,
      estHours: 3,
      cleanerRateF: 1500,
      cleanerAmountF: 4500,
      serviceFeeF: 900,
      cashFeeF: 0,
      discountF: 0,
      totalF: 5400,
      paymentMethod: 'card',
      pricingSnapshot: { kind: 'range' },
      pricingConfigVersion: 1,
      matchingMode: 'broadcast',
      engagementModel: 'marketplace',
    },
  });
  return { booking, cleaners, customer };
}

afterAll(async () => {
  const filter = { booking: { code: { contains: stamp } } };
  await prisma.bookingOffer.deleteMany({ where: filter });
  await prisma.bookingEvent.deleteMany({ where: filter });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.cleanerService.deleteMany({ where: { cleanerProfile: { user: { email: { contains: stamp } } } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('broadcast matching', () => {
  it('creates offers for all eligible cleaners, idempotently, expiring at slot − 6 h', async () => {
    const { booking, cleaners } = await fixture('offers');
    const first = await broadcastOffers(booking.id);
    expect(first.offered).toBeGreaterThanOrEqual(3); // fixture trio + seed roster
    const again = await broadcastOffers(booking.id);
    expect(again.offered).toBe(0); // idempotent

    const offers = await prisma.bookingOffer.findMany({ where: { bookingId: booking.id } });
    for (const c of cleaners) {
      expect(offers.some((o) => o.cleanerId === c.cleanerProfile!.id)).toBe(true);
    }
    const expectedExpiry = booking.scheduledAt.getTime() - 6 * 3600_000;
    expect(offers[0].expiresAt.getTime()).toBe(expectedExpiry);
  });

  it('G3 race: concurrent accepts → exactly one winner, siblings lost_race, exact reprice', async () => {
    const { booking, cleaners } = await fixture('race');
    await broadcastOffers(booking.id);
    const fixtureProfileIds = new Set(cleaners.map((c) => c.cleanerProfile!.id));
    const offers = (
      await prisma.bookingOffer.findMany({ where: { bookingId: booking.id } })
    ).filter((o) => fixtureProfileIds.has(o.cleanerId));
    expect(offers).toHaveLength(3);

    const attempts = await Promise.allSettled(
      offers.map((offer) => {
        const cleaner = cleaners.find((c) => c.cleanerProfile!.id === offer.cleanerId)!;
        return acceptOffer(offer.id, cleaner.id);
      }),
    );
    const wins = attempts.filter((r) => r.status === 'fulfilled');
    expect(wins).toHaveLength(1);

    const finalBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(finalBooking.status).toBe('accepted');
    expect(finalBooking.cleanerId).not.toBeNull();

    // Exact reprice from the winner's rate: 75 m² standard = 3 h × rate + 20 %.
    const winnerProfile = await prisma.cleanerProfile.findUniqueOrThrow({
      where: { id: finalBooking.cleanerId! },
    });
    const expectedCleanerAmount = Math.round(3 * winnerProfile.hourlyRateF!);
    expect(finalBooking.cleanerRateF).toBe(winnerProfile.hourlyRateF);
    expect(finalBooking.cleanerAmountF).toBe(expectedCleanerAmount);
    expect(finalBooking.totalF).toBe(Math.round(expectedCleanerAmount * 1.2));
    expect(finalBooking.totalF).toBeLessThanOrEqual(5400); // never above the ceiling
    expect((finalBooking.pricingSnapshot as { kind: string }).kind).toBe('exact');

    const finalOffers = await prisma.bookingOffer.findMany({ where: { bookingId: booking.id } });
    expect(finalOffers.filter((o) => o.status === 'accepted')).toHaveLength(1);
    // Every non-winning offer (fixture + seed cleaners alike) lost the race.
    expect(finalOffers.filter((o) => o.status === 'lost_race')).toHaveLength(finalOffers.length - 1);
  });

  it('rejects a foreign accept and an expired offer', async () => {
    const { booking, cleaners, customer } = await fixture('guard');
    await broadcastOffers(booking.id);
    const offer = await prisma.bookingOffer.findFirstOrThrow({
      where: { bookingId: booking.id, cleanerId: cleaners[0].cleanerProfile!.id },
    });

    await expect(acceptOffer(offer.id, customer.id)).rejects.toMatchObject({ status: 404 });

    await prisma.bookingOffer.update({
      where: { id: offer.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(acceptOffer(offer.id, cleaners[0].id)).rejects.toMatchObject({
      code: 'OFFER_EXPIRED',
    });
  });

  it('expiry job flips stale offers and times out stuck matchings', async () => {
    const soon = new Date(Date.now() + 2 * 3600_000); // < 6 h away
    const { booking } = await fixture('expire', { scheduledAt: soon });
    await broadcastOffers(booking.id); // offers already expired (slot−6h in the past)

    const result = await expireMatching();
    expect(result.expiredOffers).toBeGreaterThanOrEqual(3);
    expect(result.expiredBookings).toBeGreaterThanOrEqual(1);

    const finalBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(finalBooking.status).toBe('expired');
    const offers = await prisma.bookingOffer.findMany({ where: { bookingId: booking.id } });
    expect(offers.every((o) => o.status === 'expired')).toBe(true);
  });
});
