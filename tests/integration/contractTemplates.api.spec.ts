import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { SessionClaims } from '@/lib/shared/access';
import { launchTemplates, WATERMARK_HTML } from '@/lib/domain/contracts/templates';

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

import { POST as templatePost } from '@/app/api/admin/contract-templates/route';
import { POST as approvePost } from '@/app/api/admin/contract-templates/[id]/approve/route';
import { registerPrismaAuditSink } from '@/lib/server/auditSink';

registerPrismaAuditSink();

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;
const adminClaims: SessionClaims = {
  uid: `fb-${stamp}-cadm`,
  role: 'admin',
  verified: true,
  email: `cadm-${stamp}@test.local`,
};

function req(body?: unknown): Request {
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
  await prisma.contractTemplate.deleteMany({ where: { version: { gt: 1 }, key: 'temp_work', legalRegime: 'fbih', lang: 'bs' } });
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('contract templates (E7.1)', () => {
  it('seed shipped all 10 launch templates, watermarked and unapproved', async () => {
    expect(launchTemplates()).toHaveLength(10);
    const seeded = await prisma.contractTemplate.findMany({ where: { version: 1 } });
    expect(seeded.length).toBeGreaterThanOrEqual(10);
    const regimes = new Set(seeded.map((s) => s.legalRegime));
    for (const r of ['fbih', 'fbih_student', 'rs', 'brcko', 'obrt_selfbill']) expect(regimes).toContain(r);
    const fbihBs = seeded.find((s) => s.legalRegime === 'fbih' && s.lang === 'bs' && s.key === 'temp_work')!;
    expect(fbihBs.htmlBody).toContain('draft-watermark');
    expect(fbihBs.htmlBody).toContain('60 dana');
    expect(fbihBs.lawyerApproved).toBe(false);
  });

  it('editing creates the next version, re-injecting the watermark if stripped', async () => {
    const res = await templatePost(
      req({
        key: 'temp_work',
        legalRegime: 'fbih',
        lang: 'bs',
        htmlBody: '<h1>Izmijenjeni ugovor</h1><p>Bez vodenog žiga — namjerno uklonjen u editoru.</p>',
      }),
    );
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.template.version).toBeGreaterThanOrEqual(2);
    expect(data.template.htmlBody).toContain(WATERMARK_HTML); // guardrail: re-injected
    expect(data.template.lawyerApproved).toBe(false); // new versions always start draft

    // v1 untouched.
    const v1 = await prisma.contractTemplate.findFirstOrThrow({
      where: { key: 'temp_work', legalRegime: 'fbih', lang: 'bs', version: 1 },
    });
    expect(v1.htmlBody).toContain('Zakona o radu FBiH');
  });

  it('approval flips the compliance switch with a full audit trail', async () => {
    const target = await prisma.contractTemplate.findFirstOrThrow({
      where: { key: 'temp_work', legalRegime: 'fbih', lang: 'bs' },
      orderBy: { version: 'desc' },
    });
    const res = await approvePost(req({ approved: true }), { params: { id: target.id } });
    expect(res.status).toBe(200);
    expect((await res.json()).data.template.lawyerApproved).toBe(true);

    const auditRow = await prisma.auditLog.findFirst({
      where: { action: 'contract_template.approved', entityId: target.id },
    });
    expect(auditRow).not.toBeNull();

    // Revoke to leave the DB in the launch state.
    await approvePost(req({ approved: false }), { params: { id: target.id } });

    sessionState.current = { ...adminClaims, role: 'cleaner' };
    expect((await approvePost(req({ approved: true }), { params: { id: target.id } })).status).toBe(403);
  });
});
