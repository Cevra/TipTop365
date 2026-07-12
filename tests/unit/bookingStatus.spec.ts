import { describe, expect, it } from 'vitest';
import { BOOKING_STATUSES, STATUS_TOKEN } from '@/lib/shared/bookingStatus';

describe('booking status registry', () => {
  it('maps every status to a token', () => {
    for (const s of BOOKING_STATUSES) {
      expect(STATUS_TOKEN[s]).toBeTruthy();
    }
  });

  it('uses the alert token for negative terminal states', () => {
    expect(STATUS_TOKEN.disputed).toBe('alert');
    expect(STATUS_TOKEN.cancelled).toBe('alert');
    expect(STATUS_TOKEN.refunded).toBe('alert');
  });

  it('marks completed as done and active states as active', () => {
    expect(STATUS_TOKEN.completed).toBe('done');
    expect(STATUS_TOKEN.on_my_way).toBe('active');
    expect(STATUS_TOKEN.in_progress).toBe('active');
  });
});
