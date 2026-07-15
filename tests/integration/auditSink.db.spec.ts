import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { audit } from '@/lib/server/audit';
import { registerPrismaAuditSink } from '@/lib/server/auditSink';

// Integration (E9.1): the Prisma audit sink — audit() call sites written since
// E0.7 now persist to audit_log once the sink registers (instrumentation.ts).

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('Prisma audit sink', () => {
  it('persists audit() records with before/after payloads', async () => {
    registerPrismaAuditSink();
    registerPrismaAuditSink(); // double-registration is a no-op

    await audit({
      actorUserId: null,
      action: 'booking.reassign',
      entityType: 'booking',
      entityId: `bk-${stamp}`,
      before: { cleanerId: 'old' },
      after: { cleanerId: 'new' },
      ip: '10.0.0.5',
    });

    const row = await prisma.auditLog.findFirst({ where: { entityId: `bk-${stamp}` } });
    expect(row).not.toBeNull();
    expect(row!.action).toBe('booking.reassign');
    expect(row!.actorUserId).toBeNull(); // system actor
    expect(row!.before).toMatchObject({ cleanerId: 'old' });
    expect(row!.after).toMatchObject({ cleanerId: 'new' });
    expect(row!.ip).toBe('10.0.0.5');
  });

  it('audit() never throws into the caller even if the write fails', async () => {
    registerPrismaAuditSink();
    // entityId over any sane length still must not throw (sink errors are
    // swallowed by the audit() contract from E0.7).
    await expect(
      audit({
        actorUserId: `nonexistent-user-${stamp}`, // FK violation inside the sink
        action: 'x',
        entityType: 'y',
        entityId: `z-${stamp}`,
      }),
    ).resolves.toBeUndefined();
  });
});
