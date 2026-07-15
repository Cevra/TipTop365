import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { SessionClaims } from '@/lib/shared/access';

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

import { POST as autoConfirmJob } from '@/app/api/jobs/auto-confirm/route';
import { POST as reviewPost } from '@/app/api/bookings/[id]/review/route';

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

async function fixture(suffix: string) {
  const serviceType = await prisma.serviceType.findFirstOrThrow({ where: { key: 'standard' } });
  const customer = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-${suffix}-c`,
      email: `ar-${suffix}-${stamp}@test.local`,
      properties: { create: { street: 'AR', houseNo: suffix } },
    },
    include: { properties: true },
  });
  const cleanerUser = await prisma.user.create({
    data: {
      firebaseUid: `fb-${stamp}-${suffix}-w`,
      email: `ar-w-${suffix}-${stamp}@test.local`,
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
      cleanerId: cleanerUser.cleanerProfile!.id,
      serviceTypeId: serviceType.id,
      status: 'pending_completion',
      scheduledAt: new Date(Date.now() - 3 * 86_400_000),
      slotMinutes: 240,
      estHours: 4,
      cleanerRateF: 1200,
      cleanerAmountF: 4800,
      serviceFeeF: 960,
      cashFeeF: 0,
      discountF: 0,
      totalF: 5760,
      paymentMethod: 'cash', // cash → release books commission debt, no escrow needed
      pricingSnapshot: {},
      pricingConfigVersion: 1,
      matchingMode: 'direct',
      engagementModel: 'marketplace',
    },
  });
  return { booking, customer, cleanerUser };
}

function cronReq(): Request {
  return new Request('http://test.local/job', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
}
function reviewReq(body: unknown): Request {
  return new Request('http://test.local/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = `secret-${stamp}`;
});

afterAll(async () => {
  delete process.env.CRON_SECRET;
  await prisma.review.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.ledgerEntry.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.bookingEvent.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.walletAccount.deleteMany({
    where: { ownerId: { in: (await prisma.cleanerProfile.findMany({ where: { user: { email: { contains: stamp } } }, select: { id: true } })).map((c) => c.id) } },
  });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('auto-confirm job (E4.8, §5 48 h)', () => {
  it('completes only bookings past the snapshotted window', async () => {
    const { booking: stale } = await fixture('old');
    // Finished 50 h ago (> 48 h default).
    await prisma.bookingEvent.create({
      data: {
        bookingId: stale.id,
        fromStatus: 'in_progress',
        toStatus: 'pending_completion',
        actorType: 'cleaner',
        createdAt: new Date(Date.now() - 50 * 3600_000),
      },
    });
    const { booking: fresh } = await fixture('new');
    await prisma.bookingEvent.create({
      data: {
        bookingId: fresh.id,
        fromStatus: 'in_progress',
        toStatus: 'pending_completion',
        actorType: 'cleaner',
        createdAt: new Date(Date.now() - 2 * 3600_000), // 2 h ago
      },
    });

    const res = await autoConfirmJob(cronReq());
    expect(res.status).toBe(200);

    expect((await prisma.booking.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe('completed');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe('pending_completion');
  });

  it('rejects a bad cron secret', async () => {
    const res = await autoConfirmJob(new Request('http://x/job', { method: 'POST', headers: { authorization: 'Bearer wrong' } }));
    expect(res.status).toBe(401);
  });
});

describe('mutual reviews (E4.8 double-blind)', () => {
  it('hides until both sides review, then reveals and aggregates', async () => {
    const { booking, customer, cleanerUser } = await fixture('rev');
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'completed' } });

    sessionState.current = { uid: customer.firebaseUid, role: 'customer', verified: false, email: customer.email };
    const first = await reviewPost(reviewReq({ stars: 5, tags: ['temeljito'] }), { params: { id: booking.id } });
    expect((await first.json()).data).toMatchObject({ direction: 'customer_to_cleaner', revealed: false });
    expect((await prisma.review.findFirstOrThrow({ where: { bookingId: booking.id } })).visible).toBe(false);

    // Duplicate direction rejected.
    const dupe = await reviewPost(reviewReq({ stars: 1 }), { params: { id: booking.id } });
    expect(dupe.status).toBe(409);

    sessionState.current = { uid: cleanerUser.firebaseUid, role: 'cleaner', verified: true, email: cleanerUser.email };
    const second = await reviewPost(reviewReq({ stars: 4 }), { params: { id: booking.id } });
    expect((await second.json()).data).toMatchObject({ direction: 'cleaner_to_customer', revealed: true });

    const reviews = await prisma.review.findMany({ where: { bookingId: booking.id } });
    expect(reviews.every((r) => r.visible)).toBe(true);

    const profile = await prisma.cleanerProfile.findUniqueOrThrow({ where: { id: booking.cleanerId! } });
    expect(profile.ratingAvg).toBe(5);
    expect(profile.ratingCount).toBe(1);
  });

  it('rejects reviews on non-completed bookings and from strangers', async () => {
    const { booking, customer } = await fixture('guard');
    sessionState.current = { uid: customer.firebaseUid, role: 'customer', verified: false, email: customer.email };
    const notDone = await reviewPost(reviewReq({ stars: 5 }), { params: { id: booking.id } });
    expect(notDone.status).toBe(409);

    sessionState.current = { uid: `fb-${stamp}-stranger`, role: 'customer', verified: false, email: `str-${stamp}@test.local` };
    await prisma.booking.update({ where: { id: booking.id }, data: { status: 'completed' } });
    const foreign = await reviewPost(reviewReq({ stars: 5 }), { params: { id: booking.id } });
    expect(foreign.status).toBe(404);
  });
});
