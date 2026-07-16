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
    getSessionUser: vi.fn(async () => sessionState.current),
  };
});

import { POST as chatPost } from '@/app/api/bookings/[id]/chat/route';
import { GET as liveGet } from '@/app/api/bookings/[id]/live/route';
import { registerPrismaAuditSink } from '@/lib/server/auditSink';
import { __resetRateLimits } from '@/lib/server/rateLimit';

registerPrismaAuditSink();

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

const customerClaims: SessionClaims = { uid: `fb-${stamp}-ch-c`, role: 'customer', verified: false, email: `ch-c-${stamp}@test.local` };
const cleanerClaims: SessionClaims = { uid: `fb-${stamp}-ch-w`, role: 'cleaner', verified: true, email: `ch-w-${stamp}@test.local` };
const strangerClaims: SessionClaims = { uid: `fb-${stamp}-ch-s`, role: 'customer', verified: false, email: `ch-s-${stamp}@test.local` };

let bookingId = '';

async function fixture() {
  const standard = await prisma.serviceType.findFirstOrThrow({ where: { key: 'standard' } });
  const admin = await prisma.user.create({
    data: { firebaseUid: `fb-${stamp}-ch-adm`, email: `ch-adm-${stamp}@test.local`, role: 'admin' },
  });
  void admin;
  const customer = await prisma.user.create({
    data: {
      firebaseUid: customerClaims.uid,
      email: customerClaims.email!,
      properties: { create: { street: 'Chat', houseNo: '1' } },
    },
    include: { properties: true },
  });
  const cleaner = await prisma.user.create({
    data: {
      firebaseUid: cleanerClaims.uid,
      email: cleanerClaims.email!,
      role: 'cleaner',
      cleanerProfile: { create: {} },
    },
    include: { cleanerProfile: true },
  });
  await prisma.user.create({ data: { firebaseUid: strangerClaims.uid, email: strangerClaims.email! } });
  const booking = await prisma.booking.create({
    data: {
      code: `TT-${stamp}-CHAT`,
      customerId: customer.id,
      propertyId: customer.properties[0].id,
      cleanerId: cleaner.cleanerProfile!.id,
      serviceTypeId: standard.id,
      status: 'accepted',
      scheduledAt: new Date(Date.now() + 86_400_000),
      slotMinutes: 120,
      estHours: 2,
      cleanerRateF: 1000,
      cleanerAmountF: 2000,
      serviceFeeF: 400,
      cashFeeF: 0,
      discountF: 0,
      totalF: 2400,
      paymentMethod: 'card',
      pricingSnapshot: {},
      pricingConfigVersion: 1,
      matchingMode: 'direct',
      engagementModel: 'marketplace',
    },
  });
  bookingId = booking.id;
}

function post(body: string): Promise<Response> {
  return chatPost(
    new Request('http://test.local/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }),
    { params: { id: bookingId } },
  );
}

beforeEach(() => __resetRateLimits());

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { contains: stamp } } } });
  await prisma.chatMessage.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.property.deleteMany({ where: { owner: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('booking chat (E4.5)', () => {
  it('parties exchange messages through /live with cursor pagination', async () => {
    await fixture();
    sessionState.current = customerClaims;
    const sent = await post('Stižem u 10, ključ je kod komšije.');
    expect(sent.status).toBe(201);
    expect((await sent.json()).data.wasMasked).toBe(false);

    sessionState.current = cleanerClaims;
    await post('Super, vidimo se!');

    const first = await liveGet(new Request('http://test.local/live'), { params: { id: bookingId } });
    expect(first.status).toBe(200);
    const snap1 = (await first.json()).data;
    expect(snap1.bookingStatus).toBe('accepted');
    expect(snap1.messages).toHaveLength(2);

    // Cursor: nothing new after the last message.
    const second = await liveGet(
      new Request(`http://test.local/live?cursor=${snap1.cursor}`),
      { params: { id: bookingId } },
    );
    expect((await second.json()).data.messages).toHaveLength(0);
  });

  it('masks contact details at write time — the raw body is never stored', async () => {
    sessionState.current = cleanerClaims;
    const res = await post('Zovi me direktno na +387 61 123 456, jeftinije bez platforme');
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.wasMasked).toBe(true);
    expect(data.message.body).not.toContain('061');
    expect(data.message.flagReason).toBe('phone');

    const stored = await prisma.chatMessage.findUniqueOrThrow({ where: { id: data.message.id } });
    expect(stored.body).not.toContain('387');
    expect(stored.flagged).toBe(true);
  });

  it('3rd flagged message triggers the audited admin escalation, exactly once', async () => {
    sessionState.current = cleanerClaims;
    await post('piši na moj@mail.ba'); // flag #2 (one from previous test)
    await post('insta @cistim.sve'); // flag #3 → threshold

    const auditRows = await prisma.auditLog.count({
      where: { action: 'chat.flag_threshold_reached', entityId: bookingId },
    });
    expect(auditRows).toBe(1);
    const adminNotifications = await prisma.notification.count({
      where: { bookingId, eventKey: 'chat.flag_threshold_reached' },
    });
    expect(adminNotifications).toBeGreaterThanOrEqual(1);

    await post('i na viber 062 222 333'); // flag #4 — no second escalation
    expect(
      await prisma.auditLog.count({ where: { action: 'chat.flag_threshold_reached', entityId: bookingId } }),
    ).toBe(1);
  });

  it('gates: strangers 404, closed statuses 409', async () => {
    sessionState.current = strangerClaims;
    expect((await post('zdravo')).status).toBe(404);
    expect((await liveGet(new Request('http://test.local/live'), { params: { id: bookingId } })).status).toBe(404);

    sessionState.current = customerClaims;
    await prisma.booking.update({ where: { id: bookingId }, data: { status: 'completed' } });
    expect((await post('naknadna poruka')).status).toBe(409);
    await prisma.booking.update({ where: { id: bookingId }, data: { status: 'accepted' } });
  });
});
