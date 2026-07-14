import { describe, expect, it } from 'vitest';
import {
  CancellationRulesError,
  computeRefundF,
  parseCancellationRules,
  resolveRefundPct,
} from '@/lib/domain/cancellation';

// Seed/§6 launch rules.
const rules = parseCancellationRules([
  { hoursBefore: 24, refundPct: 100 },
  { hoursBefore: 0, refundPct: 50 },
  { noShow: true, refundPct: 0 },
]);

describe('resolveRefundPct (§6 tiers)', () => {
  it('free cancel ≥ 24 h before', () => {
    expect(resolveRefundPct(rules, { hoursBeforeSlot: 25 })).toBe(100);
    expect(resolveRefundPct(rules, { hoursBeforeSlot: 24 })).toBe(100);
  });

  it('50 % inside 24 h', () => {
    expect(resolveRefundPct(rules, { hoursBeforeSlot: 23.9 })).toBe(50);
    expect(resolveRefundPct(rules, { hoursBeforeSlot: 0.5 })).toBe(50);
    expect(resolveRefundPct(rules, { hoursBeforeSlot: 0 })).toBe(50);
  });

  it('no-show keeps everything (0 % refund) via its own flag', () => {
    expect(resolveRefundPct(rules, { hoursBeforeSlot: 50, noShow: true })).toBe(0);
  });

  it('most generous applicable rule wins regardless of order', () => {
    const shuffled = parseCancellationRules([
      { hoursBefore: 0, refundPct: 50 },
      { hoursBefore: 24, refundPct: 100 },
    ]);
    expect(resolveRefundPct(shuffled, { hoursBeforeSlot: 30 })).toBe(100);
  });

  it('negative hours (slot already passed) matches no timed rule → 0', () => {
    expect(resolveRefundPct(rules, { hoursBeforeSlot: -2 })).toBe(0);
  });
});

describe('computeRefundF (D5)', () => {
  it('rounds half up on integer fenings', () => {
    expect(computeRefundF(5760, 100)).toBe(5760);
    expect(computeRefundF(5760, 50)).toBe(2880);
    expect(computeRefundF(333, 50)).toBe(167);
    expect(computeRefundF(5760, 0)).toBe(0);
  });
});

describe('parseCancellationRules', () => {
  it('rejects malformed config loudly', () => {
    expect(() => parseCancellationRules([])).toThrow(CancellationRulesError);
    expect(() => parseCancellationRules([{ refundPct: 150 }])).toThrow(CancellationRulesError);
    expect(() => parseCancellationRules('nope')).toThrow(CancellationRulesError);
  });
});
