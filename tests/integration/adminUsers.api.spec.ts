import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { SessionClaims } from '@/lib/shared/access';

// Integration (E9.4): user search / suspend / impersonate — audited, gated,
// and suspension enforced at the requireDbUser seam.

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

// createCustomToken needs live Firebase credentials — not available in CI.
vi.mock('@/lib/server/firebaseAdmin', () => ({
  adminAuth: () => ({
    createCustomToken: vi.fn(async (uid: string, claims: object) =>
      `fake-token:${uid}:${JSON.stringify(claims)}`,
    ),
  }),
}));

import { GET as usersGet } from '@/app/api/admin/users/route';
import { POST as statusPost } from '@/app/api/admin/users/[id]/status/route';
import { POST as impersonatePost } from '@/app/api/admin/users/[id]/impersonate/route';
import { requireDbUser } from '@/lib/server/users';
import { registerPrismaAuditSink } from '@/lib/server/auditSink';

registerPrismaAuditSink();

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

const adminClaims: SessionClaims = {
  uid: `fb-${stamp}-uadm`,
  role: 'admin',
  verified: true,
  email: `uadm-${stamp}@test.local`,
};

function jsonReq(body?: unknown): Request {
  return new Request('http://test.local/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  sessionState.current = adminClaims;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { contains: stamp } } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('admin users (E9.4)', () => {
  it('searches by email fragment with role filter', async () => {
    await prisma.user.create({
      data: { firebaseUid: `fb-${stamp}-t1`, email: `target-${stamp}@test.local`, firstName: 'Tarik' },
    });
    const res = await usersGet(
      new Request(`http://test.local/api/admin/users?q=target-${stamp}&role=customer`),
    );
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.users).toHaveLength(1);
    expect(data.users[0].email).toBe(`target-${stamp}@test.local`);
  });

  it('suspends with audit, blocks the user at requireDbUser, reactivates', async () => {
    const target = await prisma.user.create({
      data: { firebaseUid: `fb-${stamp}-t2`, email: `susp-${stamp}@test.local` },
    });

    const res = await statusPost(jsonReq({ status: 'suspended', reason: 'chargeback abuse' }), {
      params: { id: target.id },
    });
    expect(res.status).toBe(200);

    await expect(
      requireDbUser({ uid: target.firebaseUid, role: 'customer', verified: false }),
    ).rejects.toMatchObject({ code: 'USER_SUSPENDED', status: 403 });

    const auditRow = await prisma.auditLog.findFirst({
      where: { action: 'user.suspended', entityId: target.id },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.after).toMatchObject({ reason: 'chargeback abuse' });

    await statusPost(jsonReq({ status: 'active' }), { params: { id: target.id } });
    await expect(
      requireDbUser({ uid: target.firebaseUid, role: 'customer', verified: false }),
    ).resolves.toMatchObject({ id: target.id });
  });

  it('admins cannot be suspended or impersonated; non-admins denied everything', async () => {
    const otherAdmin = await prisma.user.create({
      data: { firebaseUid: `fb-${stamp}-t3`, email: `adm2-${stamp}@test.local`, role: 'admin' },
    });
    expect((await statusPost(jsonReq({ status: 'suspended' }), { params: { id: otherAdmin.id } })).status).toBe(403);
    expect((await impersonatePost(jsonReq(), { params: { id: otherAdmin.id } })).status).toBe(403);

    sessionState.current = { ...adminClaims, role: 'customer' };
    expect((await usersGet(new Request('http://test.local/api/admin/users'))).status).toBe(403);
  });

  it('impersonation mints a token carrying impersonatedBy and audits it', async () => {
    const target = await prisma.user.create({
      data: { firebaseUid: `fb-${stamp}-t4`, email: `imp-${stamp}@test.local` },
    });
    const res = await impersonatePost(jsonReq(), { params: { id: target.id } });
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data.token).toContain(target.firebaseUid);
    expect(data.token).toContain(`"impersonatedBy":"${adminClaims.uid}"`);

    const auditRow = await prisma.auditLog.findFirst({
      where: { action: 'user.impersonation_started', entityId: target.id },
    });
    expect(auditRow).not.toBeNull();
  });
});
