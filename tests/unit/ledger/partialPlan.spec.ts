import { describe, expect, it } from 'vitest';
import { InvalidPostingError, partialPlan, validatePlan } from '@/lib/domain/ledger/postings';

const booking = {
  id: 'bk1',
  cleanerId: 'cl1',
  cleanerAmountF: 4800,
  serviceFeeF: 960,
  cashFeeF: 0,
  discountF: 0,
  totalF: 5760,
  paymentMethod: 'card' as const,
};

describe('partialPlan (E5.6 cleaner-first waterfall)', () => {
  it('small refund: cleaner made whole, platform keeps the rest', () => {
    const plan = partialPlan(booking, 500);
    validatePlan(plan);
    // remainder 5260 → cleaner 4800 (full share), revenue 460 (fee shortfall absorbed).
    expect(plan.entries.map((e) => [e.credit.type, e.amountF])).toEqual([
      ['platform_cash', 500],
      ['cleaner_payable', 4800],
      ['platform_revenue', 460],
    ]);
  });

  it('large refund eats the platform share first, then the cleaner share', () => {
    const plan = partialPlan(booking, 2880); // remainder 2880 < cleaner share 4800
    expect(plan.entries.map((e) => [e.credit.type, e.amountF])).toEqual([
      ['platform_cash', 2880],
      ['cleaner_payable', 2880], // platform gets nothing
    ]);
    validatePlan(plan);
  });

  it('discount reduces the cleaner share in the waterfall', () => {
    const plan = partialPlan({ ...booking, discountF: 480 }, 500);
    expect(plan.entries[1]).toMatchObject({ credit: { type: 'cleaner_payable' }, amountF: 4320 });
    expect(plan.entries[2]).toMatchObject({ credit: { type: 'platform_revenue' }, amountF: 940 });
  });

  it('shares the release idempotency key — a job can never pay out twice', () => {
    expect(partialPlan(booking, 500).idempotencyKey).toBe('release:bk1');
  });

  it('rejects edge amounts (use release/refund) and missing cleaner', () => {
    expect(() => partialPlan(booking, 0)).toThrow(InvalidPostingError);
    expect(() => partialPlan(booking, 5760)).toThrow(InvalidPostingError);
    expect(() => partialPlan({ ...booking, cleanerId: null }, 100)).toThrow(InvalidPostingError);
  });
});
