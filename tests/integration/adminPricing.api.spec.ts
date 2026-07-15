import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { SessionClaims } from '@/lib/shared/access';

// Integration (E2.3): admin pricing endpoints — engine-validated drafts,
// version monotony, exactly-one-active publish, audit trail, role gate.

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

import { GET as listGet, POST as draftPost } from '@/app/api/admin/pricing/route';
import { POST as publishPost } from '@/app/api/admin/pricing/[id]/publish/route';
import { registerPrismaAuditSink } from '@/lib/server/auditSink';

// instrumentation.ts doesn't run under vitest — register the sink explicitly
// so audit() persists (this is also what the assertion below verifies).
registerPrismaAuditSink();

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

const adminClaims: SessionClaims = {
  uid: `fb-${stamp}-padm`,
  role: 'admin',
  verified: true,
  email: `padm-${stamp}@test.local`,
};

let citySlug = '';

const validDraft = () => ({
  citySlug,
  m2Bands: { bands: [{ maxM2: 40, hours: 2.0 }, { maxM2: 80, hours: 3.0 }], extraPer40M2: 1.0 },
  rateMinF: 1000,
  rateMaxF: 1800,
  platformFeePct: 22,
  recurringDiscountPct: { weekly: 10, biweekly: 7, monthly: 5 },
  cashFeeF: 200,
  cancellationRules: [{ hoursBefore: 24, refundPct: 100 }, { hoursBefore: 0, refundPct: 50 }],
  negativeBalanceLimitF: -5000,
  autoConfirmHours: 48,
  minAfterPhotosPerRoom: 2,
});

function jsonReq(body?: unknown): Request {
  return new Request('http://test.local/api/admin/pricing', {
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
  await prisma.pricingConfig.deleteMany({ where: { city: { slug: { contains: stamp } } } });
  await prisma.city.deleteMany({ where: { slug: { contains: stamp } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('admin pricing (E2.3)', () => {
  it('creates engine-validated drafts with monotonic versions', async () => {
    const city = await prisma.city.create({
      data: { name: `Pricetown ${stamp}`, slug: `pricetown-${stamp}` },
    });
    citySlug = city.slug;

    const v1 = await draftPost(jsonReq(validDraft()));
    expect(v1.status).toBe(201);
    expect((await v1.json()).data.draft.version).toBe(1);

    const v2 = await draftPost(jsonReq(validDraft()));
    expect((await v2.json()).data.draft.version).toBe(2);

    // Engine rejection: misordered bands never reach the DB.
    const bad = await draftPost(
      jsonReq({
        ...validDraft(),
        m2Bands: { bands: [{ maxM2: 80, hours: 3 }, { maxM2: 40, hours: 2 }], extraPer40M2: 1 },
      }),
    );
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe('CONFIG_INVALID');
    expect(await prisma.pricingConfig.count({ where: { cityId: city.id } })).toBe(2);
  });

  it('publish activates exactly one version, idempotently, with an audit row', async () => {
    const configs = await prisma.pricingConfig.findMany({
      where: { city: { slug: citySlug } },
      orderBy: { version: 'asc' },
    });

    const pub1 = await publishPost(jsonReq(), { params: { id: configs[0].id } });
    expect(pub1.status).toBe(200);
    const pub2 = await publishPost(jsonReq(), { params: { id: configs[1].id } });
    expect(pub2.status).toBe(200);

    const active = await prisma.pricingConfig.findMany({
      where: { city: { slug: citySlug }, active: true },
    });
    expect(active).toHaveLength(1);
    expect(active[0].version).toBe(2);

    // Idempotent re-publish.
    await publishPost(jsonReq(), { params: { id: configs[1].id } });
    expect(
      await prisma.pricingConfig.count({ where: { city: { slug: citySlug }, active: true } }),
    ).toBe(1);

    const auditRows = await prisma.auditLog.findMany({
      where: { action: 'pricing.published', entityId: { in: configs.map((c) => c.id) } },
    });
    expect(auditRows.length).toBeGreaterThanOrEqual(2);
  });

  it('gates on the admin role and lists versions newest-first', async () => {
    sessionState.current = { ...adminClaims, role: 'customer' };
    const denied = await draftPost(jsonReq(validDraft()));
    expect(denied.status).toBe(403);

    sessionState.current = adminClaims;
    const res = await listGet(new Request(`http://test.local/api/admin/pricing?city=${citySlug}`));
    const { data } = await res.json();
    expect(data.versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
  });
});
