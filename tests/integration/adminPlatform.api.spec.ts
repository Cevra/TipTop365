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
    requireRole: vi.fn(async (...roles: string[]) => {
      if (!sessionState.current) throw new original.AuthError('UNAUTHENTICATED', 401);
      if (!roles.includes(sessionState.current.role)) throw new original.AuthError('FORBIDDEN', 403);
      return sessionState.current;
    }),
  };
});

import { POST as cityPost, PATCH as cityPatch } from '@/app/api/admin/cities/route';
import { GET as flagsGet, POST as flagsPost } from '@/app/api/admin/flags/route';
import { POST as promoPost, PATCH as promoPatch } from '@/app/api/admin/promos/route';
import { POST as campaignPost } from '@/app/api/admin/campaigns/route';
import { isEnabled, setFlag } from '@/lib/server/featureFlags';
import { registerPrismaAuditSink } from '@/lib/server/auditSink';

registerPrismaAuditSink();

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;
const adminClaims: SessionClaims = {
  uid: `fb-${stamp}-platadm`,
  role: 'admin',
  verified: true,
  email: `platadm-${stamp}@test.local`,
};

function req(method: string, body: unknown): Request {
  return new Request('http://test.local/x', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sessionState.current = adminClaims;
});

afterAll(async () => {
  await setFlag('LIVE_MAP_ENABLED', true); // restore launch value
  await prisma.notification.deleteMany({ where: { eventKey: 'campaign.blast', payload: { path: ['title'], equals: `Kampanja ${stamp}` } } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { contains: stamp } } } });
  await prisma.promoCode.deleteMany({ where: { code: { contains: stamp.toUpperCase() } } });
  await prisma.city.deleteMany({ where: { slug: { contains: stamp } } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('platform admin (E9.6)', () => {
  it('creates a city with a derived slug and toggles it, audited', async () => {
    const created = await cityPost(req('POST', { name: `Čapljina ${stamp}` }));
    expect(created.status).toBe(201);
    const { data } = await created.json();
    expect(data.city.slug).toBe(`capljina-${stamp}`); // diacritics handled

    const dup = await cityPost(req('POST', { name: `Čapljina ${stamp}` }));
    expect(dup.status).toBe(409);

    const toggled = await cityPatch(req('PATCH', { id: data.city.id, active: false }));
    expect((await toggled.json()).data.city.active).toBe(false);
    expect(await prisma.auditLog.count({ where: { action: 'city.deactivated', entityId: data.city.id } })).toBe(1);
  });

  it('flag toggle round-trips through isEnabled', async () => {
    await flagsPost(req('POST', { key: 'LIVE_MAP_ENABLED', enabled: false }));
    expect(await isEnabled('LIVE_MAP_ENABLED')).toBe(false);
    await flagsPost(req('POST', { key: 'LIVE_MAP_ENABLED', enabled: true }));
    expect(await isEnabled('LIVE_MAP_ENABLED')).toBe(true);

    const list = await flagsGet();
    const { data } = await list.json();
    expect(data.flags.map((f: { key: string }) => f.key)).toContain('CASH_PAYMENTS_ENABLED');
    // Unknown keys rejected by the schema.
    expect((await flagsPost(req('POST', { key: 'NOT_A_FLAG', enabled: true }))).status).toBe(400);
  });

  it('creates and deactivates promo codes with pct bounds', async () => {
    const code = `LJETO-${stamp.toUpperCase()}`;
    const created = await promoPost(req('POST', { code, type: 'pct', value: 15 }));
    expect(created.status).toBe(201);
    expect((await promoPost(req('POST', { code, type: 'pct', value: 15 }))).status).toBe(409);
    expect((await promoPost(req('POST', { code: `X-${code}`, type: 'pct', value: 150 }))).status).toBe(400);

    const { data } = await created.json();
    const off = await promoPatch(req('PATCH', { id: data.promo.id, active: false }));
    expect((await off.json()).data.promo.active).toBe(false);
  });

  it('campaign blast enqueues one pending outbox row per targeted active user', async () => {
    const cleanersBefore = await prisma.user.count({ where: { role: 'cleaner', status: 'active' } });
    const res = await campaignPost(
      req('POST', {
        audience: 'cleaners',
        channel: 'push',
        title: `Kampanja ${stamp}`,
        body: 'Novi bonusi za vikend termine!',
      }),
    );
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.queued).toBe(cleanersBefore);

    const pending = await prisma.notification.count({
      where: { eventKey: 'campaign.blast', status: 'pending', payload: { path: ['title'], equals: `Kampanja ${stamp}` } },
    });
    expect(pending).toBe(cleanersBefore);

    sessionState.current = { ...adminClaims, role: 'customer' };
    expect((await campaignPost(req('POST', { audience: 'all', channel: 'push', title: 'x'.repeat(5), body: 'y'.repeat(5) }))).status).toBe(403);
  });
});
