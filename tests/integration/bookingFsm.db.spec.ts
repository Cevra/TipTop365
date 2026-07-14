import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { applyBookingTransition } from '@/lib/server/bookings/applyTransition';

// Integration (E3.4): the transition applier against real Postgres — status
// updates + append-only booking_events in one tx, race-guarded.
const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

async function createDraftBooking(suffix: string) {
  const customer = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-${suffix}-cust`,
      email: `fsm-${suffix}-${stamp}@test.local`,
      properties: { create: { street: 'FSM', houseNo: suffix } },
    },
    include: { properties: true },
  });
  const cleanerUser = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-${suffix}-cl`,
      email: `fsm-cl-${suffix}-${stamp}@test.local`,
      role: 'cleaner',
      cleanerProfile: { create: {} },
    },
    include: { cleanerProfile: true },
  });
  const serviceType = await prisma.serviceType.findFirstOrThrow({ where: { key: 'standard' } });
  const booking = await prisma.booking.create({
    data: {
      code: `TT-${stamp}-${suffix}`,
      customerId: customer.id,
      propertyId: customer.properties[0].id,
      cleanerId: cleanerUser.cleanerProfile!.id,
      serviceTypeId: serviceType.id,
      scheduledAt: new Date('2026-09-01T10:00:00Z'),
      slotMinutes: 240,
      estHours: 4,
      cleanerRateF: 1200,
      cleanerAmountF: 4800,
      serviceFeeF: 960,
      cashFeeF: 0,
      discountF: 0,
      totalF: 5760,
      paymentMethod: 'card',
      pricingSnapshot: {},
      pricingConfigVersion: 1,
      matchingMode: 'direct',
      engagementModel: 'marketplace',
    },
  });
  return { booking, customer, cleanerUser };
}

afterAll(async () => {
  await prisma.bookingEvent.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('applyBookingTransition', () => {
  it('walks the full happy path writing one event per hop', async () => {
    const { booking, customer, cleanerUser } = await createDraftBooking('happy');
    const customerActor = { type: 'customer' as const, userId: customer.id };
    const cleanerActor = { type: 'cleaner' as const, userId: cleanerUser.id };

    await applyBookingTransition({ bookingId: booking.id, action: 'contract_accepted', actor: customerActor });
    await applyBookingTransition({ bookingId: booking.id, action: 'payment_secured', actor: { type: 'system' } });
    await applyBookingTransition({ bookingId: booking.id, action: 'cleaner_accepted', actor: cleanerActor });
    await applyBookingTransition({ bookingId: booking.id, action: 'cleaner_started_travel', actor: cleanerActor });
    const checkIn = await applyBookingTransition({
      bookingId: booking.id,
      action: 'checked_in',
      actor: cleanerActor,
      meta: { lat: 43.8563, lng: 18.4131, distanceM: 42 },
    });
    expect(checkIn.sideEffects).toEqual(['purge_prejob_photos']);
    await applyBookingTransition({ bookingId: booking.id, action: 'finished', actor: cleanerActor });
    const done = await applyBookingTransition({
      bookingId: booking.id,
      action: 'completion_confirmed',
      actor: customerActor,
    });
    expect(done.booking.status).toBe('completed');
    expect(done.sideEffects).toEqual(['ledger.release']);

    const events = await prisma.bookingEvent.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(events).toHaveLength(7);
    // The event chain is gapless: each fromStatus equals the previous toStatus.
    for (let i = 1; i < events.length; i++) {
      expect(events[i].fromStatus).toBe(events[i - 1].toStatus);
    }
    expect(events[0].fromStatus).toBe('draft');
    expect(events.at(-1)!.toStatus).toBe('completed');
    // GPS meta landed on the check-in event; system hop has no actorId.
    expect(events.find((e) => e.toStatus === 'in_progress')?.meta).toMatchObject({ distanceM: 42 });
    expect(events.find((e) => e.toStatus === 'matching')?.actorId).toBeNull();
  });

  it('cancellation persists cancelledBy + reason on the booking', async () => {
    const { booking, customer } = await createDraftBooking('cancel');
    await applyBookingTransition({ bookingId: booking.id, action: 'contract_accepted', actor: { type: 'customer', userId: customer.id } });
    await applyBookingTransition({ bookingId: booking.id, action: 'payment_secured', actor: { type: 'system' } });
    const cancelled = await applyBookingTransition({
      bookingId: booking.id,
      action: 'customer_cancelled',
      actor: { type: 'customer', userId: customer.id },
      reason: 'Promjena termina',
    });
    expect(cancelled.booking.status).toBe('cancelled');
    expect(cancelled.booking.cancelledBy).toBe('customer');
    expect(cancelled.booking.cancellationReason).toBe('Promjena termina');
    expect(cancelled.sideEffects).toEqual(['ledger.refund']);
  });

  it('maps FSM violations to stable API codes and writes no event', async () => {
    const { booking, customer, cleanerUser } = await createDraftBooking('illegal');

    await expect(
      applyBookingTransition({ bookingId: booking.id, action: 'checked_in', actor: { type: 'cleaner', userId: cleanerUser.id } }),
    ).rejects.toMatchObject({ code: 'ILLEGAL_TRANSITION', status: 409 });

    await expect(
      applyBookingTransition({ bookingId: booking.id, action: 'contract_accepted', actor: { type: 'cleaner', userId: cleanerUser.id } }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_ACTOR', status: 403 });

    await expect(
      applyBookingTransition({ bookingId: 'nonexistent-id', action: 'contract_accepted', actor: { type: 'customer', userId: customer.id } }),
    ).rejects.toMatchObject({ code: 'BOOKING_NOT_FOUND', status: 404 });

    expect(await prisma.bookingEvent.count({ where: { bookingId: booking.id } })).toBe(0);
  });

  it('race guard: two competing transitions — exactly one wins', async () => {
    const { booking, customer } = await createDraftBooking('race');
    const actor = { type: 'customer' as const, userId: customer.id };

    const results = await Promise.allSettled([
      applyBookingTransition({ bookingId: booking.id, action: 'contract_accepted', actor }),
      applyBookingTransition({ bookingId: booking.id, action: 'contract_accepted', actor }),
    ]);
    const wins = results.filter((r) => r.status === 'fulfilled');
    const losses = results.filter((r) => r.status === 'rejected');
    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(1);
    // The loser failed with either code depending on interleaving — both are 409s.
    const reason = (losses[0] as PromiseRejectedResult).reason;
    expect(['BOOKING_STATE_CHANGED', 'ILLEGAL_TRANSITION']).toContain(reason.code);
    expect(reason.status).toBe(409);

    // Exactly one event was written.
    expect(await prisma.bookingEvent.count({ where: { bookingId: booking.id } })).toBe(1);
  });
});
