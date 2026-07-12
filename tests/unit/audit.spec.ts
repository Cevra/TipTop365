import { describe, expect, it } from 'vitest';
import { buildAuditRecord } from '@/lib/server/audit';

describe('buildAuditRecord', () => {
  it('carries fields through and attaches the timestamp', () => {
    const rec = buildAuditRecord(
      {
        actorUserId: 'u1',
        action: 'booking.cancel',
        entityType: 'booking',
        entityId: 'b7',
        before: { status: 'accepted' },
        after: { status: 'cancelled' },
        ip: '1.2.3.4',
      },
      '2026-07-12T10:00:00.000Z',
    );
    expect(rec).toEqual({
      actorUserId: 'u1',
      action: 'booking.cancel',
      entityType: 'booking',
      entityId: 'b7',
      before: { status: 'accepted' },
      after: { status: 'cancelled' },
      ip: '1.2.3.4',
      at: '2026-07-12T10:00:00.000Z',
    });
  });

  it('normalizes missing actor/ip to null', () => {
    const rec = buildAuditRecord(
      { actorUserId: null, action: 'flag.toggle', entityType: 'feature_flag', entityId: 'SMS_ENABLED' },
      '2026-07-12T10:00:00.000Z',
    );
    expect(rec.actorUserId).toBeNull();
    expect(rec.ip).toBeNull();
    expect(rec.before).toBeUndefined();
  });
});
