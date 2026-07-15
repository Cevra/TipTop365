import 'server-only';
import { prisma } from '@/lib/server/db';
import { setAuditSink, type AuditRecord } from '@/lib/server/audit';

// E9.1: the Prisma persistence sink the E0.7 audit helper was designed for.
// Registered once per server process from instrumentation.ts, so EVERY
// audit() call site — admin mutations, impersonation, verification decisions —
// lands in audit_log without the call sites changing.

let registered = false;

export function registerPrismaAuditSink(): void {
  if (registered) return;
  registered = true;
  setAuditSink(async (record: AuditRecord) => {
    await prisma.auditLog.create({
      data: {
        actorUserId: record.actorUserId,
        action: record.action,
        entityType: record.entityType,
        entityId: record.entityId,
        before: record.before === undefined ? undefined : JSON.parse(JSON.stringify(record.before)),
        after: record.after === undefined ? undefined : JSON.parse(JSON.stringify(record.after)),
        ip: record.ip,
        createdAt: new Date(record.at),
      },
    });
  });
}
