import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { SessionClaims } from '@/lib/shared/access';
import { __resetMockProvider } from '@/lib/server/payments/mockProvider';
import { __resetRateLimits } from '@/lib/server/rateLimit';

// Integration (E3.5): confirm endpoint — contract-accept + capture + FSM,
// against real Postgres with the MockProvider. Session mocked at the
// cookie-verification seam only (same pattern as properties.api.spec).

const sessionState: { current: SessionClaims | null } = { current: null };

vi.mock('@/lib/server/auth/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server/auth/session')>();
  return {
    ...original,
    requireSession: vi.fn(async () => {
      if (!sessionState.current) throw new original.AuthError('UNAUTHENTICATED', 401);
      return sessionState.current;
    }),
  };
});

import { POST as confirmPost } from '@/app/api/bookings/[id]/confirm/route';

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

const customerClaims: SessionClaims = {
  uid: `fb-${stamp}-confirm`,
  role: 'customer',
  verified: false,
  email: `confirm-${stamp}@test.local`,
};

async function createDraft(suffix: string, paymentMethod: 'card' | 'cash' = 'card') {
  const customer = await prisma.user.upsert({
    where: { firebaseUid: customerClaims.uid },
    create: { firebaseUid: customerClaims.uid, email: customerClaims.email!, properties: { create: { street: 'Confirm', houseNo: suffix } } },
    update: {},
    include: { properties: true },
  });
  const property =
    customer.properties[0] ??
    (await prisma.property.create({ data: { ownerId: customer.id, street: 'Confirm', houseNo: suffix } }));
  const serviceType = await prisma.serviceType.findFirstOrThrow({ where: { key: 'standard' } });
  return prisma.booking.create({
    data: {
      code: `TT-${stamp}-${suffix}`,
      customerId: customer.id,
      propertyId: property.id,
      serviceTypeId: serviceType.id,
      scheduledAt: new Date('2026-09-10T10:00:00Z'),
      slotMinutes: 240,
      estHours: 4,
      cleanerRateF: 1200,
      cleanerAmountF: 4800,
      serviceFeeF: 960,
      cashFeeF: paymentMethod === 'cash' ? 200 : 0,
      discountF: 0,
      totalF: paymentMethod === 'cash' ? 5960 : 5760,
      paymentMethod,
      pricingSnapshot: {},
      pricingConfigVersion: 1,
      matchingMode: 'broadcast',
      engagementModel: 'marketplace',
    },
  });
}

function confirmRequest(body: unknown): Request {
  return new Request('http://test.local/api/bookings/x/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sessionState.current = customerClaims;
  __resetMockProvider();
  __resetRateLimits(); // the E12.3 payment cap would trip the suite's total
});

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.bookingEvent.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('POST /api/bookings/:id/confirm', () => {
  it('card happy path: draft → pending_payment → matching with a payments row', async () => {
    const booking = await createDraft('happy');
    const res = await confirmPost(confirmRequest({ acceptContract: true, cardToken: 'tok_ok' }), {
      params: { id: booking.id },
    });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.booking.status).toBe('matching');
    expect(data.payment.status).toBe('succeeded');
    expect(data.payment.amountF).toBe(5760);

    const events = await prisma.bookingEvent.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((e) => e.toStatus)).toEqual(['pending_payment', 'matching']);
    expect(events[0].meta).toMatchObject({ contractStub: true });
  });

  it('declined card: 402, payments row recorded, booking stays pending_payment, retry works', async () => {
    const booking = await createDraft('decline');
    const declined = await confirmPost(
      confirmRequest({ acceptContract: true, cardToken: 'tok_declined' }),
      { params: { id: booking.id } },
    );
    expect(declined.status).toBe(402);
    expect((await declined.json()).error.code).toBe('PAYMENT_DECLINED');

    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.status).toBe('pending_payment');
    expect(await prisma.payment.count({ where: { bookingId: booking.id, status: 'declined' } })).toBe(1);

    // Retry with a good card — contract step is skipped, capture succeeds.
    const retry = await confirmPost(confirmRequest({ acceptContract: true, cardToken: 'tok_ok' }), {
      params: { id: booking.id },
    });
    expect(retry.status).toBe(200);
    expect((await retry.json()).data.booking.status).toBe('matching');
    expect(await prisma.payment.count({ where: { bookingId: booking.id } })).toBe(2);
  });

  it('cash path: no capture, straight to matching (flag-gated)', async () => {
    const booking = await createDraft('cash', 'cash');
    const res = await confirmPost(confirmRequest({ acceptContract: true }), {
      params: { id: booking.id },
    });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.booking.status).toBe('matching');
    expect(data.payment).toBeNull();
    expect(await prisma.payment.count({ where: { bookingId: booking.id } })).toBe(0);
  });

  it('requires the contract acceptance literal and ownership', async () => {
    const booking = await createDraft('guard');

    const noAccept = await confirmPost(confirmRequest({ acceptContract: false }), {
      params: { id: booking.id },
    });
    expect(noAccept.status).toBe(400);

    sessionState.current = {
      uid: `fb-${stamp}-other`,
      role: 'customer',
      verified: false,
      email: `other-${stamp}@test.local`,
    };
    const foreign = await confirmPost(confirmRequest({ acceptContract: true, cardToken: 'tok_ok' }), {
      params: { id: booking.id },
    });
    expect(foreign.status).toBe(404);
  });

  it('409s a booking that is past payment', async () => {
    const booking = await createDraft('done');
    await confirmPost(confirmRequest({ acceptContract: true, cardToken: 'tok_ok' }), {
      params: { id: booking.id },
    });
    const again = await confirmPost(confirmRequest({ acceptContract: true, cardToken: 'tok_ok' }), {
      params: { id: booking.id },
    });
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe('ILLEGAL_TRANSITION');
  });
});
