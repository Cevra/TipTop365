import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_TYPES,
  balanceDelta,
  normalSide,
  UnknownAccountTypeError,
} from '@/lib/domain/ledger/accounts';
import {
  capturePlan,
  InvalidPostingError,
  payoutPlan,
  refundPlan,
  releasePlan,
  topupPlan,
  validatePlan,
} from '@/lib/domain/ledger/postings';

const cardBooking = {
  id: 'bk1',
  cleanerId: 'cl1',
  cleanerAmountF: 4800,
  serviceFeeF: 960,
  cashFeeF: 0,
  discountF: 0,
  totalF: 5760,
  paymentMethod: 'card' as const,
};

describe('accounts (§7 vocabulary + normal sides)', () => {
  it('declares all five §7 types with real double-entry normal sides', () => {
    expect(Object.keys(ACCOUNT_TYPES).sort()).toEqual([
      'cleaner_payable',
      'cleaner_receivable',
      'customer_escrow',
      'platform_cash',
      'platform_revenue',
    ]);
    expect(normalSide('platform_cash')).toBe('debit');
    expect(normalSide('cleaner_payable')).toBe('credit');
  });

  it('balanceDelta grows on the normal side, shrinks on the other', () => {
    expect(balanceDelta('platform_cash', 'debit', 100)).toBe(100);
    expect(balanceDelta('platform_cash', 'credit', 100)).toBe(-100);
    expect(balanceDelta('customer_escrow', 'credit', 100)).toBe(100);
    expect(balanceDelta('customer_escrow', 'debit', 100)).toBe(-100);
  });

  it('throws on unregistered types (D19 growth = extend the map)', () => {
    expect(() => normalSide('employed_payroll')).toThrow(UnknownAccountTypeError);
  });
});

describe('posting plans (§7 posting map, row by row)', () => {
  it('capture: platform_cash D / customer_escrow C, total', () => {
    const plan = capturePlan(cardBooking, 'pay1');
    expect(plan.idempotencyKey).toBe('capture:pay1');
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]).toMatchObject({
      debit: { type: 'platform_cash' },
      credit: { type: 'customer_escrow' },
      amountF: 5760,
      kind: 'capture',
    });
    validatePlan(plan);
  });

  it('release (card): escrow→payable amount−discount + escrow→revenue fee', () => {
    const plan = releasePlan({ ...cardBooking, discountF: 480, cleanerAmountF: 4800 });
    expect(plan.entries).toHaveLength(2);
    expect(plan.entries[0]).toMatchObject({
      credit: { type: 'cleaner_payable', ownerId: 'cl1' },
      amountF: 4320,
      kind: 'release',
    });
    expect(plan.entries[1]).toMatchObject({
      credit: { type: 'platform_revenue' },
      amountF: 960,
      kind: 'fee',
    });
    validatePlan(plan);
  });

  it('release (cash): single cash_commission debt row, fee + cash fee', () => {
    const plan = releasePlan({ ...cardBooking, paymentMethod: 'cash', cashFeeF: 200 });
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0]).toMatchObject({
      debit: { type: 'cleaner_receivable', ownerId: 'cl1' },
      credit: { type: 'platform_revenue' },
      amountF: 1160,
      kind: 'cash_commission',
    });
  });

  it('release without a cleaner throws', () => {
    expect(() => releasePlan({ ...cardBooking, cleanerId: null })).toThrow(InvalidPostingError);
  });

  it('refund: refunded part → cash, kept penalty → revenue; bounds enforced', () => {
    const half = refundPlan(cardBooking, 2880, 'bk1');
    expect(half.entries).toHaveLength(2);
    expect(half.entries[0]).toMatchObject({ credit: { type: 'platform_cash' }, amountF: 2880, kind: 'refund' });
    expect(half.entries[1]).toMatchObject({ credit: { type: 'platform_revenue' }, amountF: 2880, kind: 'adjustment' });

    const full = refundPlan(cardBooking, 5760, 'bk1');
    expect(full.entries).toHaveLength(1); // nothing kept

    expect(() => refundPlan(cardBooking, 6000, 'bk1')).toThrow(InvalidPostingError);
    expect(() => refundPlan(cardBooking, -1, 'bk1')).toThrow(InvalidPostingError);
  });

  it('topup and payout mirror their §7 rows', () => {
    expect(topupPlan('cl1', 2000, 'pay9').entries[0]).toMatchObject({
      debit: { type: 'platform_cash' },
      credit: { type: 'cleaner_receivable', ownerId: 'cl1' },
      kind: 'topup',
    });
    expect(payoutPlan('cl1', 4320, 'po1').entries[0]).toMatchObject({
      debit: { type: 'cleaner_payable', ownerId: 'cl1' },
      credit: { type: 'platform_cash' },
      kind: 'payout',
    });
  });
});

describe('validatePlan invariants (amount_f > 0, balanced, distinct accounts)', () => {
  const entry = capturePlan(cardBooking, 'x').entries[0];
  it('rejects non-positive, fractional and empty plans', () => {
    expect(() => validatePlan({ idempotencyKey: 'k', entries: [] })).toThrow(InvalidPostingError);
    expect(() =>
      validatePlan({ idempotencyKey: 'k', entries: [{ ...entry, amountF: 0 }] }),
    ).toThrow(InvalidPostingError);
    expect(() =>
      validatePlan({ idempotencyKey: 'k', entries: [{ ...entry, amountF: 10.5 }] }),
    ).toThrow(InvalidPostingError);
    expect(() =>
      validatePlan({ idempotencyKey: 'k', entries: [{ ...entry, credit: entry.debit }] }),
    ).toThrow(InvalidPostingError);
    expect(() => validatePlan({ idempotencyKey: '', entries: [entry] })).toThrow(InvalidPostingError);
  });
});
