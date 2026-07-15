import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { SessionClaims } from '@/lib/shared/access';
import { __resetMockProvider } from '@/lib/server/payments/mockProvider';
import { capturePlan } from '@/lib/domain/ledger/postings';
import { post } from '@/lib/server/ledger/engine';

const sessionState: { current: SessionClaims | null } = { current: null };

vi.mock('@/lib/server/auth/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server/auth/session')>();
  return {
    ...original,
    requireSession: vi.fn(async () => {
      if (!sessionState.current) throw new original.AuthError('UNAUTHENTICATED', 401);
      return sessionState.current;
    }),
    requireRole: vi.fn(async (...roles: string[]) => {
      if (!sessionState.current) throw new original.AuthError('UNAUTHENTICATED', 401);
      if (!roles.includes(sessionState.current.role)) throw new original.AuthError('FORBIDDEN', 403);
      return sessionState.current;
    }),
  };
});

import { POST as actionsPost } from '@/app/api/admin/bookings/[id]/actions/route';
import { registerPrismaAuditSink } from '@/lib/server/auditSink';

registerPrismaAuditSink();

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;
const adminClaims: SessionClaims = {
  uid: `fb-${stamp}-badm`,
  role: 'admin',
  verified: true,
  email: `badm-${stamp}@test.local`,
};

async function fixture(suffix: string, status: 'accepted' | 'completed') {
  const sarajevo = await prisma.city.findUniqueOrThrow({ where: { slug: 'sarajevo' } });
  const standard = await prisma.serviceType.findUniqueOrThrow({ where: { key: 'standard' } });
  const customer = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-${suffix}-c`,
      email: `ab-${suffix}-${stamp}@test.local`,
      properties: { create: { street: 'AB', houseNo: suffix, sizeM2: 60, cityId: sarajevo.id } },
    },
    include: { properties: true },
  });
  const cleaner = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-${suffix}-w`,
      email: `ab-w-${suffix}-${stamp}@test.local`,
      role: 'cleaner',
      cleanerProfile: { create: { hourlyRateF: 1200, cityId: sarajevo.id } },
    },
    include: { cleanerProfile: true },
  });
  const booking = await prisma.booking.create({
    data: {
      code: `TT-${stamp}-${suffix}`,
      customerId: customer.id,
      propertyId: customer.properties[0].id,
      cleanerId: cleaner.cleanerProfile!.id,
      serviceTypeId: standard.id,
      status,
      scheduledAt: new Date(Date.now() + 30 * 3600_000),
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
      matchingMode: 'direct',
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
  return { booking, cleanerProfileId: cleaner.cleanerProfile!.id };
}

function req(body: unknown): Request {
  return new Request('http://test.local/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sessionState.current = adminClaims;
  __resetMockProvider();
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { contains: stamp } } } });
  await prisma.ledgerEntry.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.payment.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.bookingEvent.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('admin booking actions (E9.5)', () => {
  it('no-show cancels with full refund posting and audit', async () => {
    const { booking } = await fixture('ns', 'accepted');
    await post(capturePlan(booking, `pay-${stamp}-ns`));

    const res = await actionsPost(req({ action: 'no_show', reason: 'Korisnik nije otvorio' }), {
      params: { id: booking.id },
    });
    expect(res.status).toBe(200);
    const after = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.status).toBe('cancelled');
    expect(after.cancelledBy).toBe('admin');

    const refundEntries = await prisma.ledgerEntry.findMany({
      where: { txId: `refund:noshow:${booking.id}` },
    });
    expect(refundEntries.some((e) => e.kind === 'refund' && e.amountF === 4320)).toBe(true);
    expect(
      await prisma.auditLog.count({ where: { action: 'booking.no_show_reported', entityId: booking.id } }),
    ).toBe(1);
  });

  it('reassign swaps the cleaner with an exact reprice at the new rate', async () => {
    const { booking } = await fixture('ra', 'accepted');
    const cheaper = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-ra2`,
        email: `ab-ra2-${stamp}@test.local`,
        role: 'cleaner',
        cleanerProfile: { create: { hourlyRateF: 1000 } },
      },
      include: { cleanerProfile: true },
    });

    const res = await actionsPost(
      req({ action: 'reassign', cleanerProfileId: cheaper.cleanerProfile!.id }),
      { params: { id: booking.id } },
    );
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.booking.cleanerId).toBe(cheaper.cleanerProfile!.id);
    // 60 m² standard = 2.5 h × 1000 = 2500 + 20 % = 3000.
    expect(data.booking.cleanerRateF).toBe(1000);
    expect(data.booking.totalF).toBe(3000);
    expect(
      await prisma.auditLog.count({ where: { action: 'booking.reassigned', entityId: booking.id } }),
    ).toBe(1);
  });

  it('manual refund sources escrow pre-settlement and revenue post-settlement', async () => {
    const pre = await fixture('mr1', 'accepted');
    await post(capturePlan(pre.booking, `pay-${stamp}-mr1`));
    const preRes = await actionsPost(req({ action: 'refund', amountF: 1000, reason: 'goodwill' }), {
      params: { id: pre.booking.id },
    });
    expect((await preRes.json()).data.source).toBe('escrow');

    const post_ = await fixture('mr2', 'completed');
    const postRes = await actionsPost(req({ action: 'refund', amountF: 1000, reason: 'goodwill' }), {
      params: { id: post_.booking.id },
    });
    expect((await postRes.json()).data.source).toBe('revenue');

    const over = await actionsPost(req({ action: 'refund', amountF: 99999, reason: 'x' }), {
      params: { id: post_.booking.id },
    });
    expect(over.status).toBe(400);

    expect(
      await prisma.payment.count({
        where: { booking: { code: { contains: stamp } }, kind: 'refund', status: 'refunded' },
      }),
    ).toBe(2);
  });
});
