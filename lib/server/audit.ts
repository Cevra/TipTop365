import 'server-only';

// Audit helper (plan D13). Every admin/system mutation calls audit(); the entry
// is normalized and handed to a pluggable sink. The DEFAULT sink emits a
// structured JSON log line (picked up by the log aggregator / Sentry per D21).
// E1.5 adds the audit_log table and E9 registers a Prisma sink via setAuditSink,
// so call sites written now don't change.

export interface AuditEntry {
  actorUserId: string | null;
  action: string; // e.g. 'booking.reassign'
  entityType: string; // e.g. 'booking'
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

export interface AuditRecord extends AuditEntry {
  at: string; // ISO timestamp
}

export type AuditSink = (record: AuditRecord) => void | Promise<void>;

const consoleSink: AuditSink = (record) => {
  console.log(`[audit] ${JSON.stringify(record)}`);
};

let sink: AuditSink = consoleSink;

/** Register the persistence sink (Prisma) in E9. */
export function setAuditSink(next: AuditSink): void {
  sink = next;
}

/** Pure: attach a timestamp + normalize optional fields. Unit-tested. */
export function buildAuditRecord(entry: AuditEntry, at: string): AuditRecord {
  return {
    actorUserId: entry.actorUserId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before,
    after: entry.after,
    ip: entry.ip ?? null,
    at,
  };
}

/** Record an audit entry. Never throws into the caller — auditing must not
 * break the mutation it records. */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await sink(buildAuditRecord(entry, new Date().toISOString()));
  } catch (err) {
    console.error('[audit] sink failed:', err);
  }
}
