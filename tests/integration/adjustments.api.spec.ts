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

import { POST as requestPost } from '@/app/api/bookings/[id]/adjustments/route';
import { POST as decidePost } from '@/app/api/bookings/[id]/adjustments/[adjId]/route';

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

const cleanerClaims: SessionClaims = {
  uid: `fb-${stamp}-adj-w`,
  role: 'cleaner',
  verified: true,
  email: `adj-w-${stamp}@test.local`,
};
const customerClaims: SessionClaims = {
  uid: `fb-${stamp}-adj-c`,
  role: 'customer',
  verified: false,
  email: `adj-c-${stamp}@test.local`,
};

let bookingId = '';

async function fixture() {
  const sarajevo = await prisma.city.findUniqueOrThrow({ where: { slug: 'sarajevo' } });
  const standard = await prisma.serviceType.findFirstOrThrow({ where: { key: 'standard' } });
  const customer = await prisma.user.create({
    data: {
      firebaseUid: customerClaims.uid,
      email: customerClaims.email!,
      properties: { create: { street: 'Adj', houseNo: '1', sizeM2: 60, cityId: sarajevo.id } },
    },
    include: { properties: true },
  });
  const cleaner = await prisma.user.create({
    data: {
      firebaseUid: cleanerClaims.uid,
      email: cleanerClaims.email!,
      role: 'cleaner',
      cleanerProfile: { create: { hourlyRateF: 1200 } },
    },
    include: { cleanerProfile: true },
  });
  const booking = await prisma.booking.create({
    data: {
      code: `TT-${stamp}-ADJ`,
      customerId: customer.id,
      propertyId: customer.properties[0].id,
      cleanerId: cleaner.cleanerProfile!.id,
      serviceTypeId: standard.id,
      status: 'in_progress',
      scheduledAt: new Date(),
      slotMinutes: 150,
      estHours: 2.5,
      cleanerRateF: 1200,
      cleanerAmountF: 3000,
      serviceFeeF: 600,
      cashFeeF: 0,
      discountF: 0,
      totalF: 3600,
      paymentMethod: 'card',
      pricingSnapshot: {},
      pricingConfigVersion: 1,
      matchingMode: 'direct',
      engagementModel: 'marketplace',
    },
  });
  bookingId = booking.id;
}

function req(body: unknown): Request {
  return new Request('http://test.local/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  __resetMockProvider();
});

afterAll(async () => {
  await prisma.ledgerEntry.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.payment.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.priceAdjustment.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('price adjustments (E4.7, §5)', () => {
  it('cleaner requests a quarter-stepped delta priced from the booking rate + snapshot fee', async () => {
    await fixture();
    sessionState.current = cleanerClaims;

    const res = await requestPost(req({ extraHours: 1.5, reason: 'Zapušten stan, dodatno vrijeme' }), {
      params: { id: bookingId },
    });
    expect(res.status).toBe(201);
    const { data } = await res.json();
    // 1.5 h × 1200 = 1800 + 20 % fee 360 = 2160.
    expect(data.adjustment.extraAmountF).toBe(2160);
    expect(data.adjustment.status).toBe('requested');

    // Second open request rejected; bad step rejected.
    expect((await requestPost(req({ extraHours: 1, reason: 'više' }), { params: { id: bookingId } })).status).toBe(409);
    expect((await requestPost(req({ extraHours: 0.3, reason: 'krivo' }), { params: { id: bookingId } })).status).toBe(400);
  });

  it('customer approval captures the delta and moves every money column', async () => {
    sessionState.current = customerClaims;
    const adjustment = await prisma.priceAdjustment.findFirstOrThrow({
      where: { bookingId, status: 'requested' },
    });

    const res = await decidePost(req({ action: 'approve', cardToken: 'tok_ok' }), {
      params: { id: bookingId, adjId: adjustment.id },
    });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.booking.estHours).toBe(4); // 2.5 + 1.5
    expect(data.booking.cleanerAmountF).toBe(4800); // 3000 + 1800
    expect(data.booking.serviceFeeF).toBe(960); // 600 + 360
    expect(data.booking.totalF).toBe(5760); // 3600 + 2160
    expect(data.adjustment.status).toBe('approved');

    // Delta capture: payment row + escrow posting.
    expect(
      await prisma.payment.count({ where: { bookingId, kind: 'capture', amountF: 2160 } }),
    ).toBe(1);
    const entry = await prisma.ledgerEntry.findUnique({
      where: { idempotencyKey: `capture:adjustment:${adjustment.id}` },
    });
    expect(entry?.amountF).toBe(2160);

    // Approving again is rejected.
    expect(
      (await decidePost(req({ action: 'approve', cardToken: 'tok_ok' }), { params: { id: bookingId, adjId: adjustment.id } })).status,
    ).toBe(409);
  });

  it('reject leaves money untouched; guards hold', async () => {
    sessionState.current = cleanerClaims;
    const created = await requestPost(req({ extraHours: 0.5, reason: 'Dodatni balkon' }), {
      params: { id: bookingId },
    });
    const adjId = (await created.json()).data.adjustment.id;

    sessionState.current = customerClaims;
    const before = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const res = await decidePost(req({ action: 'reject' }), { params: { id: bookingId, adjId } });
    expect(res.status).toBe(200);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(after.totalF).toBe(before.totalF);

    // Foreign customer can't decide; cleaner can't decide their own request.
    sessionState.current = cleanerClaims;
    expect((await decidePost(req({ action: 'approve' }), { params: { id: bookingId, adjId } })).status).toBe(404);
  });
});
