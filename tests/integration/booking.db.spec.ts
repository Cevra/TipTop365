import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Integration: round-trips the E1.3 booking block against real Postgres —
// bookings, booking_addons, booking_events, booking_offers, recurring_plans,
// price_adjustments, chat_messages. Requires DATABASE_URL (npm run test:integration).
const prisma = new PrismaClient();

const stamp = `it${Date.now() % 1e9}`;

let fixtureCounter = 0;

// Each call gets its own suffix — tests in this file each call makeFixtures()
// once, and every created row must be independently unique.
async function makeFixtures() {
  const id = `${stamp}-${fixtureCounter++}`;
  const serviceType = await prisma.serviceType.create({
    data: {
      key: `booking-svc-${id}`,
      nameBs: 'Standardno',
      nameEn: 'Standard',
      durationMultiplier: 1.0,
    },
  });
  const addon = await prisma.addon.create({
    data: { key: `booking-addon-${id}`, nameBs: 'Rerna', nameEn: 'Oven', hours: 1.0, unit: 'fixed' },
  });
  const customer = await prisma.user.create({
    data: { firebaseUid: `fb-${id}-cust`, email: `cust-${id}@test.local`, role: 'customer' },
  });
  const cleanerUser = await prisma.user.create({
    data: {
      firebaseUid: `fb-${id}-clean`,
      email: `clean-${id}@test.local`,
      role: 'cleaner',
      cleanerProfile: { create: { hourlyRateF: 1200 } },
    },
    include: { cleanerProfile: true },
  });
  const property = await prisma.property.create({
    data: { ownerId: customer.id, street: 'Ferhadija', houseNo: '1' },
  });
  return { serviceType, addon, customer, cleanerProfile: cleanerUser.cleanerProfile!, property };
}

afterAll(async () => {
  await prisma.chatMessage.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.priceAdjustment.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.bookingOffer.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.bookingEvent.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.bookingAddon.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.recurringPlan.deleteMany({ where: { customer: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.addon.deleteMany({ where: { key: { contains: stamp } } });
  await prisma.serviceType.deleteMany({ where: { key: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('booking block round-trip', () => {
  it('creates a full booking graph: addons, events, offers, adjustment, chat', async () => {
    const { serviceType, addon, customer, cleanerProfile, property } = await makeFixtures();

    const booking = await prisma.booking.create({
      data: {
        code: `TT-${stamp}-1`,
        customerId: customer.id,
        propertyId: property.id,
        cleanerId: cleanerProfile.id,
        serviceTypeId: serviceType.id,
        scheduledAt: new Date('2026-08-01T09:00:00Z'),
        slotMinutes: 240,
        estHours: 4,
        cleanerRateF: 1200,
        cleanerAmountF: 4800,
        serviceFeeF: 960,
        cashFeeF: 0,
        discountF: 0,
        totalF: 5760,
        paymentMethod: 'card',
        pricingSnapshot: { band: '61-80', hours: 4, addons: ['oven'] },
        pricingConfigVersion: 1,
        matchingMode: 'direct',
        engagementModel: 'marketplace',
        contractId: `not-a-real-fk-${stamp}`, // plain column, no relation yet (contracts = E1.5)
        addons: {
          create: [{ addonId: addon.id, qty: 1, hoursSnapshot: 1.0, priceFSnapshot: 1200 }],
        },
      },
      include: { addons: true },
    });

    // Declared defaults + worked-example numbers (§6) land as specified.
    expect(booking.status).toBe('draft');
    expect(booking.currency).toBe('BAM');
    expect(booking.totalF).toBe(5760);
    expect(booking.addons).toHaveLength(1);
    expect(booking.contractId).toBe(`not-a-real-fk-${stamp}`);

    await prisma.bookingEvent.create({
      data: { bookingId: booking.id, toStatus: 'pending_payment', actorType: 'customer', actorId: customer.id },
    });
    const autoConfirmEvent = await prisma.bookingEvent.create({
      data: {
        bookingId: booking.id,
        fromStatus: 'pending_completion',
        toStatus: 'completed',
        actorType: 'system', // no actor id — the 48h auto-confirm job
      },
    });
    expect(autoConfirmEvent.actorId).toBeNull();

    const offer = await prisma.bookingOffer.create({
      data: {
        bookingId: booking.id,
        cleanerId: cleanerProfile.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(offer.status).toBe('offered');

    const lostRaceOffer = await prisma.bookingOffer.update({
      where: { id: offer.id },
      data: { status: 'lost_race' },
    });
    expect(lostRaceOffer.status).toBe('lost_race');

    const adjustment = await prisma.priceAdjustment.create({
      data: {
        bookingId: booking.id,
        requestedById: cleanerProfile.id,
        reason: 'Extra soiling found on arrival',
        extraHours: 1,
        extraAmountF: 1200,
      },
    });
    expect(adjustment.status).toBe('requested');

    const message = await prisma.chatMessage.create({
      data: { bookingId: booking.id, senderId: customer.id, body: 'Hvala!' },
    });
    expect(message.flagged).toBe(false);
    expect(message.flagReason).toBeNull();

    const flagged = await prisma.chatMessage.create({
      data: {
        bookingId: booking.id,
        senderId: customer.id,
        body: 'zovi me na [masked]',
        flagged: true,
        flagReason: 'phone',
      },
    });
    expect(flagged.flagReason).toBe('phone');

    const events = await prisma.bookingEvent.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((e) => e.toStatus)).toEqual(['pending_payment', 'completed']);
  });

  it('enforces a unique booking code', async () => {
    const { serviceType, customer, property } = await makeFixtures();
    const code = `TT-${stamp}-dup`;
    const base = {
      customerId: customer.id,
      propertyId: property.id,
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
      matchingMode: 'broadcast' as const,
      engagementModel: 'marketplace' as const,
    };
    await prisma.booking.create({ data: { code, ...base } });
    await expect(prisma.booking.create({ data: { code, ...base } })).rejects.toThrow();
  });

  it('links a recurring plan to a spawned booking', async () => {
    const { serviceType, customer, property, cleanerProfile } = await makeFixtures();

    const plan = await prisma.recurringPlan.create({
      data: {
        customerId: customer.id,
        propertyId: property.id,
        frequency: 'weekly',
        weekday: 1,
        time: '14:00',
        nextRunDate: new Date('2026-08-03T00:00:00Z'),
        serviceTypeId: serviceType.id,
        addonsTemplate: [{ addonKey: 'oven', qty: 1 }],
        preferredCleanerId: cleanerProfile.id,
      },
    });
    expect(plan.active).toBe(true);

    const spawned = await prisma.booking.create({
      data: {
        code: `TT-${stamp}-recur`,
        customerId: customer.id,
        propertyId: property.id,
        cleanerId: cleanerProfile.id,
        serviceTypeId: serviceType.id,
        recurringPlanId: plan.id,
        scheduledAt: new Date('2026-08-03T14:00:00Z'),
        slotMinutes: 150,
        estHours: 2.5,
        cleanerRateF: 1200,
        cleanerAmountF: 3000,
        serviceFeeF: 540,
        cashFeeF: 0,
        discountF: 300,
        totalF: 3240,
        paymentMethod: 'card',
        pricingSnapshot: {},
        pricingConfigVersion: 1,
        matchingMode: 'direct',
        engagementModel: 'marketplace',
      },
      include: { recurringPlan: true },
    });
    expect(spawned.recurringPlan?.id).toBe(plan.id);

    const withBookings = await prisma.recurringPlan.findUnique({
      where: { id: plan.id },
      include: { bookings: true },
    });
    expect(withBookings?.bookings).toHaveLength(1);
  });
});
