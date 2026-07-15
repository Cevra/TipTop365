import { describe, expect, it } from 'vitest';
import {
  DAY_LIMITS,
  evaluateDayLimit,
  studentContractAllowed,
  usedDays,
  wouldConsumeDay,
} from '@/lib/domain/dayLimits';

const day = (iso: string, year?: number) => ({
  workDate: new Date(`${iso}T00:00:00.000Z`),
  year: year ?? Number(iso.slice(0, 4)),
});

describe('regime limits (§8.1)', () => {
  it('pins the statutory numbers: FBiH 60, student 180, RS 90, Brčko 60, obrt unlimited', () => {
    expect(DAY_LIMITS).toEqual({ fbih: 60, fbih_student: 180, rs: 90, brcko: 60, obrt: null });
  });
});

describe('usedDays (§8.3 unique-day counting)', () => {
  it('counts distinct days — two visits one day = 1 day', () => {
    const entries = [day('2026-08-01'), day('2026-08-01'), day('2026-08-02')];
    expect(usedDays(entries, 2026)).toBe(2);
  });

  it('year boundary: Dec 31 and Jan 1 land in different years', () => {
    const entries = [day('2026-12-31'), day('2027-01-01')];
    expect(usedDays(entries, 2026)).toBe(1);
    expect(usedDays(entries, 2027)).toBe(1);
  });
});

describe('evaluateDayLimit thresholds (80 % warn / 100 % block)', () => {
  it('FBiH: warns at 48/60, blocks at 60/60', () => {
    expect(evaluateDayLimit({ regime: 'fbih', used: 47 })).toMatchObject({ warn: false, blocked: false, remainingDays: 13 });
    expect(evaluateDayLimit({ regime: 'fbih', used: 48 })).toMatchObject({ warn: true, blocked: false, pct: 80 });
    expect(evaluateDayLimit({ regime: 'fbih', used: 59 })).toMatchObject({ warn: true, blocked: false, remainingDays: 1 });
    expect(evaluateDayLimit({ regime: 'fbih', used: 60 })).toMatchObject({ blocked: true, remainingDays: 0 });
    expect(evaluateDayLimit({ regime: 'fbih', used: 61 })).toMatchObject({ blocked: true, remainingDays: 0 });
  });

  it('student 180 and RS 90 use their own limits', () => {
    expect(evaluateDayLimit({ regime: 'fbih_student', used: 144 })).toMatchObject({ warn: true, blocked: false });
    expect(evaluateDayLimit({ regime: 'rs', used: 90 })).toMatchObject({ blocked: true });
  });

  it('obrt is unlimited — never warns, never blocks', () => {
    expect(evaluateDayLimit({ regime: 'obrt', used: 500 })).toMatchObject({
      limit: null,
      pct: null,
      warn: false,
      blocked: false,
    });
  });

  it('Brčko override wins (admin-configurable, §8.1)', () => {
    expect(evaluateDayLimit({ regime: 'brcko', used: 65, limitOverride: 70 })).toMatchObject({
      limit: 70,
      blocked: false,
      warn: true, // 93 %
    });
    expect(evaluateDayLimit({ regime: 'fbih', used: 10, limitOverride: null })).toMatchObject({
      limit: null,
      blocked: false,
    });
  });
});

describe('student contract cap (≤ 2/yr, §8.1)', () => {
  it('allows the first two, blocks the third', () => {
    expect(studentContractAllowed(0)).toBe(true);
    expect(studentContractAllowed(1)).toBe(true);
    expect(studentContractAllowed(2)).toBe(false);
  });
});

describe('wouldConsumeDay', () => {
  it('same-day second visit consumes nothing; a new day does', () => {
    const entries = [day('2026-08-01')];
    expect(wouldConsumeDay(entries, new Date('2026-08-01T15:00:00.000Z'))).toBe(false);
    expect(wouldConsumeDay(entries, new Date('2026-08-02T09:00:00.000Z'))).toBe(true);
    // Same calendar date next year is a fresh day (regime years reset).
    expect(wouldConsumeDay(entries, new Date('2027-08-01T09:00:00.000Z'))).toBe(true);
  });
});
