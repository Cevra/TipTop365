import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  buildQuote,
  estimateHours,
  parsePricingConfig,
  type PricingConfigData,
} from '@/lib/domain/pricing';

// Property tests (plan §13 E2.1: "never negative, breakdown sums to total").
// Randomized valid inputs against the seed-shaped launch config.
const cfg: PricingConfigData = parsePricingConfig({
  version: 1,
  m2Bands: {
    bands: [
      { maxM2: 40, hours: 2.0 },
      { maxM2: 60, hours: 2.5 },
      { maxM2: 80, hours: 3.0 },
      { maxM2: 100, hours: 3.5 },
      { maxM2: 130, hours: 4.5 },
      { maxM2: 170, hours: 5.5 },
    ],
    extraPer40M2: 1.0,
  },
  recurringDiscountPct: { weekly: 10, biweekly: 7, monthly: 5 },
  rateMinF: 800,
  rateMaxF: 1500,
  platformFeePct: 20,
  cashFeeF: 200,
});

const arbAddon = fc.record({
  key: fc.constantFrom('oven', 'fridge', 'windows', 'balcony', 'cabinets', 'ironing'),
  hours: fc.constantFrom(0.25, 0.5, 1.0),
  qty: fc.integer({ min: 0, max: 20 }),
});

const arbQuoteInput = fc.record({
  m2: fc.integer({ min: 1, max: 500 }),
  durationMultiplier: fc.constantFrom(1.0, 1.6, 1.8, 0.9),
  addons: fc.array(arbAddon, { maxLength: 6 }),
  rateF: fc.integer({ min: 800, max: 1500 }),
  paymentMethod: fc.constantFrom('card', 'cash') as fc.Arbitrary<'card' | 'cash'>,
  recurring: fc.option(fc.constantFrom('weekly', 'biweekly', 'monthly') as fc.Arbitrary<'weekly' | 'biweekly' | 'monthly'>, { nil: undefined }),
});

describe('pricing engine properties', () => {
  it('breakdown always sums to total; nothing is ever negative; all money is integer', () => {
    fc.assert(
      fc.property(arbQuoteInput, (input) => {
        const quote = buildQuote({
          m2: input.m2,
          serviceTypeKey: 'any',
          durationMultiplier: input.durationMultiplier,
          addons: input.addons,
          rateF: input.rateF,
          cfg,
          opts: { paymentMethod: input.paymentMethod, recurring: input.recurring },
        });
        expect(quote.cleanerAmountF - quote.discountF + quote.serviceFeeF + quote.cashFeeF).toBe(
          quote.totalF,
        );
        for (const v of [quote.cleanerAmountF, quote.discountF, quote.serviceFeeF, quote.cashFeeF, quote.totalF]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(v)).toBe(true);
        }
        expect(quote.discountF).toBeLessThanOrEqual(quote.cleanerAmountF);
        expect(quote.estHours).toBeGreaterThan(0);
      }),
      { numRuns: 500 },
    );
  });

  it('hours are monotone non-decreasing in m²', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 499 }),
        fc.integer({ min: 1, max: 100 }),
        fc.constantFrom(1.0, 1.6, 1.8, 0.9),
        (m2, delta, mult) => {
          const lo = estimateHours({ m2, durationMultiplier: mult, addons: [], cfg });
          const hi = estimateHours({ m2: m2 + delta, durationMultiplier: mult, addons: [], cfg });
          expect(hi).toBeGreaterThanOrEqual(lo);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('card total never exceeds the cash total for the same booking', () => {
    fc.assert(
      fc.property(arbQuoteInput, (input) => {
        const base = {
          m2: input.m2,
          serviceTypeKey: 'any',
          durationMultiplier: input.durationMultiplier,
          addons: input.addons,
          rateF: input.rateF,
          cfg,
        };
        const card = buildQuote({ ...base, opts: { paymentMethod: 'card', recurring: input.recurring } });
        const cash = buildQuote({ ...base, opts: { paymentMethod: 'cash', recurring: input.recurring } });
        expect(card.totalF).toBeLessThanOrEqual(cash.totalF);
      }),
      { numRuns: 300 },
    );
  });

  it('recurring discount never increases the total', () => {
    fc.assert(
      fc.property(arbQuoteInput, (input) => {
        const base = {
          m2: input.m2,
          serviceTypeKey: 'any',
          durationMultiplier: input.durationMultiplier,
          addons: input.addons,
          rateF: input.rateF,
          cfg,
        };
        const oneOff = buildQuote({ ...base, opts: { paymentMethod: input.paymentMethod } });
        const weekly = buildQuote({ ...base, opts: { paymentMethod: input.paymentMethod, recurring: 'weekly' } });
        expect(weekly.totalF).toBeLessThanOrEqual(oneOff.totalF);
      }),
      { numRuns: 300 },
    );
  });
});
