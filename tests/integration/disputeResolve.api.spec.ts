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

import { POST as resolvePost } from '@/app/api/admin/disputes/[id]/resolve/route';
import { registerPrismaAuditSink } from '@/lib/server/auditSink';

// instrumentation.ts does this in the real server; vitest needs it explicitly.
registerPrismaAuditSink();

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

const adminClaims: SessionClaims = {
  uid: `fb-${stamp}-dadm`,
  role: 'admin',
  verified: true,
  email: `dadm-${stamp}@test.local`,
};

async function disputedFixture(suffix: string) {
  const serviceType = await prisma.serviceType.findFirstOrThrow({ where: { key: 'standard' } });
  const customer = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-${suffix}-c`,
      email: `dr-${suffix}-${stamp}@test.local`,
      properties: { create: { street: 'DR', houseNo: suffix } },
    },
    include: { properties: true },
  });
  const cleaner = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-${suffix}-w`,
      email: `dr-w-${suffix}-${stamp}@test.local`,
      role: 'cleaner',
      cleanerProfile: { create: { hourlyRateF: 1200 } },
    },
    include: { cleanerProfile: true },
  });
  const booking = await prisma.booking.create({
    data: {
      code: `TT-${stamp}-${suffix}`,
      customerId: customer.id,
      propertyId: customer.properties[0].id,
      cleanerId: cleaner.cleanerProfile!.id,
      serviceTypeId: serviceType.id,
      status: 'disputed',
      scheduledAt: new Date(),
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
  await post(capturePlan({ ...booking, paymentMethod: 'card' }, `pay-${stamp}-${suffix}`));
  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      provider: 'mock',
      providerRef: `mock-${stamp}-${suffix}`,
      kind: 'capture',
      status: 'succeeded',
      amountF: 5760,
    },
  });
  const dispute = await prisma.dispute.create({
    data: { bookingId: booking.id, openedById: customer.id, reason: 'Nezadovoljstvo' },
  });
  return { booking, dispute, cleanerProfileId: cleaner.cleanerProfile!.id };
}

function req(body: unknown): Request {
  return new Request('http://test.local/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.7.7.7' },
    body: JSON.stringify(body),
  });
}

async function balance(type: string, ownerId: string | null = null): Promise<number> {
  const a = await prisma.walletAccount.findFirst({ where: { ownerType: type, ownerId } });
  return a?.balanceF ?? 0;
}

beforeEach(() => {
  sessionState.current = adminClaims;
  __resetMockProvider();
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { contains: stamp } } } });
  await prisma.payment.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.ledgerEntry.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.dispute.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.bookingEvent.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('POST /api/admin/disputes/:id/resolve (E5.6)', () => {
  it('partial: refund to customer, cleaner-first remainder, dispute row + audit', async () => {
    const { dispute, cleanerProfileId } = await disputedFixture('par');
    const res = await resolvePost(req({ outcome: 'partial', partialRefundF: 2000, notes: 'Pola-pola' }), {
      params: { id: dispute.id },
    });
    expect(res.status).toBe(200);
    const { data } = await res.json();

    expect(data.dispute.status).toBe('resolved_partial');
    expect(data.dispute.resolutionAmountF).toBe(2000);
    expect(data.booking.status).toBe('completed');
    expect(data.refund.amountF).toBe(2000);
    // Remainder 3760 < cleaner share 4800 → all to the cleaner, platform absorbs.
    expect(await balance('cleaner_payable', cleanerProfileId)).toBe(3760);

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityId: dispute.id, action: 'dispute.resolve.partial' },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.after).toMatchObject({ refundF: 2000 });
  });

  it('refund: full amount back, booking → refunded, no cleaner payout', async () => {
    const { dispute, cleanerProfileId } = await disputedFixture('ref');
    const res = await resolvePost(req({ outcome: 'refund' }), { params: { id: dispute.id } });
    const { data } = await res.json();
    expect(data.booking.status).toBe('refunded');
    expect(data.refund.amountF).toBe(5760);
    expect(await balance('cleaner_payable', cleanerProfileId)).toBe(0);
  });

  it('guards: non-admin 403, double-resolve 409, oversized partial 400', async () => {
    const { dispute } = await disputedFixture('grd');

    sessionState.current = { ...adminClaims, role: 'customer' };
    expect((await resolvePost(req({ outcome: 'release' }), { params: { id: dispute.id } })).status).toBe(403);

    sessionState.current = adminClaims;
    const tooBig = await resolvePost(req({ outcome: 'partial', partialRefundF: 99999 }), {
      params: { id: dispute.id },
    });
    expect(tooBig.status).toBe(400);

    await resolvePost(req({ outcome: 'release' }), { params: { id: dispute.id } });
    const again = await resolvePost(req({ outcome: 'refund' }), { params: { id: dispute.id } });
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe('DISPUTE_ALREADY_RESOLVED');
  });
});
