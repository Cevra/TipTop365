import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { SessionClaims } from '@/lib/shared/access';

const sessionState: { current: SessionClaims | null } = { current: null };
const claimsCalls: { uid: string; claims: unknown }[] = [];

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
// Firebase custom-claims writer — network call, mocked; we assert the intent.
vi.mock('@/lib/server/auth/claims', () => ({
  setUserClaims: vi.fn(async (uid: string, claims: unknown) => {
    claimsCalls.push({ uid, claims });
  }),
}));

import { POST as applyPost } from '@/app/api/verification/apply/route';
import { PATCH as adminPatch } from '@/app/api/admin/verification/[id]/route';
import { registerPrismaAuditSink } from '@/lib/server/auditSink';

registerPrismaAuditSink();

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

const adminClaims: SessionClaims = {
  uid: `fb-${stamp}-vadm`,
  role: 'admin',
  verified: true,
  email: `vadm-${stamp}@test.local`,
};

function patchReq(body: unknown): Request {
  return new Request('http://test.local/v', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.8.8.8' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sessionState.current = adminClaims;
  claimsCalls.length = 0;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { contains: stamp } } } });
  await prisma.verificationApplication.deleteMany({ where: { cleaner: { email: { contains: stamp } } } });
  await prisma.cleanerProfile.deleteMany({ where: { user: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('verification pipeline (E9.3)', () => {
  it('apply → schedule → checklist → approve grants tier, idChecked and the verified claim', async () => {
    const cleanerUser = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-vc`,
        email: `vc-${stamp}@test.local`,
        role: 'cleaner',
        cleanerProfile: { create: { hourlyRateF: 1000 } },
      },
    });

    sessionState.current = {
      uid: cleanerUser.firebaseUid,
      role: 'cleaner',
      verified: false,
      email: cleanerUser.email,
    };
    const applied = await applyPost();
    expect(applied.status).toBe(201);
    const { data } = await applied.json();
    const appId = data.application.id;

    // Second open application rejected.
    expect((await applyPost()).status).toBe(409);

    sessionState.current = adminClaims;
    // Approve before the checklist confirms the ID → rejected (§2 ID-checked badge).
    const early = await adminPatch(patchReq({ op: 'approve' }), { params: { id: appId } });
    expect(early.status).toBe(409);
    expect((await early.json()).error.code).toBe('CHECKLIST_ID_NOT_VERIFIED');

    await adminPatch(patchReq({ op: 'schedule', interviewAt: '2026-08-01T10:00', mode: 'video' }), {
      params: { id: appId },
    });
    await adminPatch(
      patchReq({ op: 'checklist', checklist: { id_verified: true, references_checked: true } }),
      { params: { id: appId } },
    );
    const approved = await adminPatch(patchReq({ op: 'approve' }), { params: { id: appId } });
    expect(approved.status).toBe(200);
    expect((await approved.json()).data.application.status).toBe('approved');

    const profile = await prisma.cleanerProfile.findFirstOrThrow({
      where: { user: { id: cleanerUser.id } },
    });
    expect(profile.tier).toBe('verified');
    expect(profile.idChecked).toBe(true);
    expect(profile.verifiedAt).not.toBeNull();

    // The single authoritative claims writer was invoked with verified=true.
    expect(claimsCalls).toEqual([
      { uid: cleanerUser.firebaseUid, claims: { role: 'cleaner', verified: true } },
    ]);

    // Every op audited.
    const auditActions = (
      await prisma.auditLog.findMany({ where: { entityId: appId }, orderBy: { createdAt: 'asc' } })
    ).map((a) => a.action);
    expect(auditActions).toEqual([
      'verification.schedule',
      'verification.checklist',
      'verification.approve',
    ]);

    // Closed application can't be re-worked.
    const reopen = await adminPatch(patchReq({ op: 'reject', reason: 'x' }), { params: { id: appId } });
    expect(reopen.status).toBe(409);
  });

  it('reject records the reason and never touches the tier or claims', async () => {
    const cleanerUser = await prisma.user.create({
      data: {
        firebaseUid: `fb-${stamp}-vr`,
        email: `vr-${stamp}@test.local`,
        role: 'cleaner',
        cleanerProfile: { create: {} },
      },
    });
    const application = await prisma.verificationApplication.create({
      data: { cleanerId: cleanerUser.id },
    });

    const rejected = await adminPatch(patchReq({ op: 'reject', reason: 'Reference nedostupne' }), {
      params: { id: application.id },
    });
    expect(rejected.status).toBe(200);
    const row = await prisma.verificationApplication.findUniqueOrThrow({
      where: { id: application.id },
    });
    expect(row.status).toBe('rejected');
    expect(row.rejectionReason).toBe('Reference nedostupne');
    expect(claimsCalls).toHaveLength(0);
    const profile = await prisma.cleanerProfile.findFirstOrThrow({
      where: { user: { id: cleanerUser.id } },
    });
    expect(profile.tier).toBe('registered');
  });
});
