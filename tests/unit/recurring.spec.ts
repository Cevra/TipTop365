import { describe, expect, it } from 'vitest';
import { isDue, nextRunDate } from '@/lib/domain/recurring';

describe('nextRunDate (E3.10)', () => {
  it('advances weekly and biweekly by exact days, keeping the time', () => {
    const from = new Date('2026-08-01T10:00:00.000Z');
    expect(nextRunDate('weekly', from).toISOString()).toBe('2026-08-08T10:00:00.000Z');
    expect(nextRunDate('biweekly', from).toISOString()).toBe('2026-08-15T10:00:00.000Z');
  });

  it('advances monthly clamping to the shorter month', () => {
    expect(nextRunDate('monthly', new Date('2026-08-15T10:00:00.000Z')).toISOString()).toBe(
      '2026-09-15T10:00:00.000Z',
    );
    // Jan 31 → Feb 28 (2027 is not a leap year), not Mar 3.
    expect(nextRunDate('monthly', new Date('2027-01-31T09:00:00.000Z')).toISOString()).toBe(
      '2027-02-28T09:00:00.000Z',
    );
  });

  it('year rollover works', () => {
    expect(nextRunDate('monthly', new Date('2026-12-20T08:00:00.000Z')).toISOString()).toBe(
      '2027-01-20T08:00:00.000Z',
    );
  });
});

describe('isDue (14-day horizon)', () => {
  const now = new Date('2026-08-01T00:00:00.000Z');
  it('due inside the horizon, not beyond it', () => {
    expect(isDue(new Date('2026-08-10T10:00:00.000Z'), now)).toBe(true);
    expect(isDue(new Date('2026-08-15T00:00:00.000Z'), now)).toBe(true); // exactly 14 d
    expect(isDue(new Date('2026-08-16T00:00:01.000Z'), now)).toBe(false);
    expect(isDue(new Date('2026-07-20T00:00:00.000Z'), now)).toBe(true); // overdue still due
  });
});
