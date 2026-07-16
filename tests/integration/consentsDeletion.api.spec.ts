import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { SessionClaims } from '@/lib/shared/access';
import { missingConsents, POLICY_VERSIONS } from '@/lib/domain/consents';

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

// anonymizeUser calls adminAuth().deleteUser — no Firebase creds in CI.
vi.mock('@/lib/server/firebaseAdmin', () => ({
  adminAuth: () => ({ deleteUser: vi.fn(async () => {}) }),
}));

import { GET as consentsGet, POST as consentsPost } from '@/app/api/consents/route';
import { POST as deletionPost } from '@/app/api/account/deletion/route';
import { GET as adminQueueGet, POST as adminProcessPost } from '@/app/api/admin/deletion-requests/route';
import { registerPrismaAuditSink } from '@/lib/server/auditSink';

registerPrismaAuditSink();

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;
const userClaims: SessionClaims = { uid: `fb-${stamp}-gdpr`, role: 'customer', verified: false, email: `gdpr-${stamp}@test.local` };
const adminClaims: SessionClaims = { uid: `fb-${stamp}-gadm`, role: 'admin', verified: true, email: `gadm-${stamp}@test.local` };

function req(body?: unknown): Request {
  return new Request('http://test.local/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  sessionState.current = userClaims;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { OR: [{ actor: { email: { contains: stamp } } }, { actor: { email: { contains: 'anonymized' } } }] } });
  await prisma.deletionRequest.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.deletionRequest.deleteMany({ where: { user: { email: { contains: `deleted-` } } } });
  await prisma.consent.deleteMany({
    where: { user: { OR: [{ email: { contains: stamp } }, { email: { contains: 'anonymized.tiptop365.ba' } }] } },
  });
  await prisma.chatMessage.deleteMany({ where: { booking: { code: { contains: stamp } } } });
  await prisma.booking.deleteMany({ where: { code: { contains: stamp } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { OR: [{ email: { contains: stamp } }, { email: { contains: 'anonymized' } }] } } });
  await prisma.property.deleteMany({ where: { owner: { OR: [{ email: { contains: stamp } }, { email: { contains: 'anonymized' } }] } } });
  await prisma.user.deleteMany({ where: { OR: [{ email: { contains: stamp } }, { email: { contains: 'anonymized.tiptop365.ba' } }] } });
  await prisma.$disconnect();
});

describe('consents (E12.2)', () => {
  it('missingConsents drives re-prompt on version bumps', () => {
    expect(missingConsents([])).toEqual(['tos', 'privacy']);
    expect(missingConsents([{ kind: 'tos', version: POLICY_VERSIONS.tos }])).toEqual(['privacy']);
    expect(missingConsents([{ kind: 'tos', version: '2020-01' }])).toEqual(['tos', 'privacy']);
  });

  it('records consent for the current version, idempotently, with IP', async () => {
    const first = await consentsPost(req({ kind: 'tos' }));
    expect(first.status).toBe(201);
    const replay = await consentsPost(req({ kind: 'tos' }));
    expect(replay.status).toBe(200);

    await consentsPost(req({ kind: 'privacy' }));
    const state = await (await consentsGet()).json();
    expect(state.data.missing).toEqual([]);
    expect(state.data.consents.length).toBe(2);
  });
});

describe('right-to-delete (E12.2, §8.5)', () => {
  it('anonymizes the person, keeps pseudonymized statutory records', async () => {
    // Give the user a property, a completed booking and a chat message.
    const me = await prisma.user.findUniqueOrThrow({ where: { firebaseUid: userClaims.uid } });
    const sarajevo = await prisma.city.findUniqueOrThrow({ where: { slug: 'sarajevo' } });
    const standard = await prisma.serviceType.findFirstOrThrow({ where: { key: 'standard' } });
    const property = await prisma.property.create({
      data: { ownerId: me.id, street: 'Tajna ulica', houseNo: '7', accessNotes: 'šifra 1234', cityId: sarajevo.id, sizeM2: 50 },
    });
    const booking = await prisma.booking.create({
      data: {
        code: `TT-${stamp}-GDPR`, customerId: me.id, propertyId: property.id, serviceTypeId: standard.id,
        status: 'completed', scheduledAt: new Date(), slotMinutes: 120, estHours: 2,
        cleanerRateF: 1000, cleanerAmountF: 2000, serviceFeeF: 400, cashFeeF: 0, discountF: 0, totalF: 2400,
        paymentMethod: 'card', pricingSnapshot: {}, pricingConfigVersion: 1, matchingMode: 'direct', engagementModel: 'marketplace',
      },
    });
    await prisma.chatMessage.create({ data: { bookingId: booking.id, senderId: me.id, body: 'Šifra od vrata je 1234' } });

    const created = await deletionPost(req());
    expect(created.status).toBe(201);
    const replay = await deletionPost(req());
    expect(replay.status).toBe(200); // idempotent while open

    sessionState.current = adminClaims;
    const queue = await (await adminQueueGet()).json();
    const mine = queue.data.requests.find((r: { user: { email: string } }) => r.user.email === userClaims.email);
    expect(mine).toBeTruthy();

    const processed = await adminProcessPost(req({ id: mine.id }));
    expect(processed.status).toBe(200);
    const { data } = await processed.json();
    expect(data.request.status).toBe('completed');

    // Person is gone…
    const after = await prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    expect(after.email).toContain('anonymized.tiptop365.ba');
    expect(after.firstName).toBeNull();
    expect(after.status).toBe('deleted');
    const scrubbedProperty = await prisma.property.findUniqueOrThrow({ where: { id: property.id } });
    expect(scrubbedProperty.street).toBeNull();
    expect(scrubbedProperty.accessNotes).toBeNull();
    const maskedMessage = await prisma.chatMessage.findFirstOrThrow({ where: { bookingId: booking.id } });
    expect(maskedMessage.body).not.toContain('1234');

    // …the statutory records are not.
    const keptBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(keptBooking.totalF).toBe(2400);
    expect(keptBooking.customerId).toBe(me.id);

    expect(
      await prisma.auditLog.count({ where: { action: 'account.deletion_processed', entityId: mine.id } }),
    ).toBe(1);
  });

  it('blocks deletion with bookings in flight', async () => {
    const other = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-gdpr2`,
        email: `gdpr2-${stamp}@test.local`,
        properties: { create: { street: 'X', houseNo: '1' } },
      },
      include: { properties: true },
    });
    const standard = await prisma.serviceType.findFirstOrThrow({ where: { key: 'standard' } });
    await prisma.booking.create({
      data: {
        code: `TT-${stamp}-GDPR2`, customerId: other.id, propertyId: other.properties[0].id, serviceTypeId: standard.id,
        status: 'accepted', scheduledAt: new Date(Date.now() + 86_400_000), slotMinutes: 120, estHours: 2,
        cleanerRateF: 1000, cleanerAmountF: 2000, serviceFeeF: 400, cashFeeF: 0, discountF: 0, totalF: 2400,
        paymentMethod: 'card', pricingSnapshot: {}, pricingConfigVersion: 1, matchingMode: 'direct', engagementModel: 'marketplace',
      },
    });
    sessionState.current = { uid: `fb-${stamp}-gdpr2`, role: 'customer', verified: false, email: `gdpr2-${stamp}@test.local` };
    const res = await deletionPost(req());
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('BOOKINGS_IN_FLIGHT');
  });
});
