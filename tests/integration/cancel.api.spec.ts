import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { SessionClaims } from '@/lib/shared/access';
import { __resetMockProvider } from '@/lib/server/payments/mockProvider';

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

import { POST as cancelPost } from '@/app/api/bookings/[id]/cancel/route';

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;
const claims: SessionClaims = {
  uid: `fb-${stamp}-cx`,
  role: 'customer',
  verified: false,
  email: `cx-${stamp}@test.local`,
};

async function fixture(suffix: string, status: 'matching' | 'accepted', hoursAhead: number) {
  const sarajevo = await prisma.city.findUniqueOrThrow({ where: { slug: 'sarajevo' } });
  const standard = await prisma.serviceType.findUniqueOrThrow({ where: { key: 'standard' } });
  const user = await prisma.user.upsert({
    where: { firebaseUid: claims.uid },
    create: {
      firebaseUid: claims.uid,
      email: claims.email!,
      properties: { create: { street: 'Cx', houseNo: suffix, sizeM2: 60, cityId: sarajevo.id } },
    },
    update: {},
    include: { properties: true },
  });
  const booking = await prisma.booking.create({
    data: {
      code: `TT-${stamp}-${suffix}`,
      customerId: user.id,
      propertyId: user.properties[0].id,
      serviceTypeId: standard.id,
      status,
      scheduledAt: new Date(Date.now() + hoursAhead * 3600_000),
      slotMinutes: 180,
      estHours: 3,
      cleanerRateF: 1200,
      cleanerAmountF: 3600,
      serviceFeeF: 720,
      cashFeeF: 0,
      discountF: 0,
      totalF: 4320,
      paymentMethod: 'card',
      pricingSnapshot: {},
      pricingConfigVersion: 1,
      matchingMode: 'broadcast',
      engagementModel: 'marketplace',
    },
  });
  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      provider: 'mock',
      providerRef: `mock-${stamp}-${suffix}`,
      kind: 'capture',
      status: 'succeeded',
      amountF: 4320,
    },
  });
  return booking;
}

function cancelReq(body: unknown = { reason: 'Promjena plana' }): Request {
  return new Request('http://test.local/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sessionState.current = claims;
  __resetMockProvider();
});

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.bookingEvent.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('POST /api/bookings/:id/cancel', () => {
  it('matching cancels free (100 %) even inside 24 h', async () => {
    const booking = await fixture('free', 'matching', 5);
    const res = await cancelPost(cancelReq(), { params: { id: booking.id } });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.refundPct).toBe(100);
    expect(data.refundF).toBe(4320);
    expect(data.booking.status).toBe('cancelled');
    expect(data.booking.cancelledBy).toBe('customer');
    expect(data.refund.kind).toBe('refund');
    expect(data.refund.amountF).toBe(4320);
  });

  it('accepted ≥ 24 h before → 100 %; inside 24 h → 50 % per config tiers', async () => {
    const early = await fixture('early', 'accepted', 30);
    const earlyRes = await (await cancelPost(cancelReq(), { params: { id: early.id } })).json();
    expect(earlyRes.data.refundPct).toBe(100);

    const late = await fixture('late', 'accepted', 5);
    const lateRes = await (await cancelPost(cancelReq(), { params: { id: late.id } })).json();
    expect(lateRes.data.refundPct).toBe(50);
    expect(lateRes.data.refundF).toBe(2160);
    expect(lateRes.data.refund.amountF).toBe(2160);
  });

  it('rejects non-cancellable states and foreign bookings', async () => {
    const done = await fixture('done', 'accepted', 30);
    await prisma.booking.update({ where: { id: done.id }, data: { status: 'completed' } });
    const res = await cancelPost(cancelReq(), { params: { id: done.id } });
    expect(res.status).toBe(409);

    sessionState.current = { ...claims, uid: `fb-${stamp}-other`, email: `other-${stamp}@test.local` };
    const foreign = await cancelPost(cancelReq(), { params: { id: done.id } });
    expect(foreign.status).toBe(404);
  });
});
