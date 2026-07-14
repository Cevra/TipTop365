import { describe, expect, it } from 'vitest';
import {
  baseHoursForM2,
  buildQuote,
  estimateHours,
  parsePricingConfig,
  price,
  PricingConfigError,
  PricingError,
  roundToQuarter,
  type PricingConfigData,
} from '@/lib/domain/pricing';
import { formatKM } from '@/lib/shared/format';

// The seed's launch config (§6 numbers) — also proves the engine accepts the
// exact jsonb shape prisma/seed.ts writes.
const seedRow = {
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
};

const cfg: PricingConfigData = parsePricingConfig(seedRow);
const oven = { key: 'oven', hours: 1.0, qty: 1 };

describe('§6 worked examples (the canonical fixtures)', () => {
  it('75 m² standard + oven @ 12 KM/h, 20 % fee, card → 4.0 h, 57,60 KM', () => {
    const quote = buildQuote({
      m2: 75,
      serviceTypeKey: 'standard',
      durationMultiplier: 1.0,
      addons: [oven],
      rateF: 1200,
      cfg,
      opts: { paymentMethod: 'card' },
    });
    expect(quote.baseHours).toBe(3.0); // band 61–80
    expect(quote.estHours).toBe(4.0); // + 1.0 h oven
    expect(quote.cleanerAmountF).toBe(4800);
    expect(quote.serviceFeeF).toBe(960);
    expect(quote.discountF).toBe(0);
    expect(quote.cashFeeF).toBe(0);
    expect(quote.totalF).toBe(5760);
    expect(formatKM(quote.totalF)).toBe('57,60 KM');
    expect(quote.pricingConfigVersion).toBe(1);
  });

  it('same booking weekly recurring −10 % → 51,84 KM', () => {
    const quote = buildQuote({
      m2: 75,
      serviceTypeKey: 'standard',
      durationMultiplier: 1.0,
      addons: [oven],
      rateF: 1200,
      cfg,
      opts: { paymentMethod: 'card', recurring: 'weekly' },
    });
    expect(quote.discountF).toBe(480); // 10 % of 4 800
    expect(quote.cleanerAmountF - quote.discountF).toBe(4320);
    expect(quote.serviceFeeF).toBe(864); // 20 % of 4 320
    expect(quote.totalF).toBe(5184);
    expect(formatKM(quote.totalF)).toBe('51,84 KM');
  });
});

describe('baseHoursForM2 band lookup', () => {
  it('hits band edges exactly', () => {
    expect(baseHoursForM2(40, cfg)).toBe(2.0);
    expect(baseHoursForM2(41, cfg)).toBe(2.5);
    expect(baseHoursForM2(170, cfg)).toBe(5.5);
  });

  it('extrapolates +1 h per started 40 m² beyond the last band', () => {
    expect(baseHoursForM2(171, cfg)).toBe(6.5); // 1 m² over → 1 started block
    expect(baseHoursForM2(210, cfg)).toBe(6.5); // exactly 40 over
    expect(baseHoursForM2(211, cfg)).toBe(7.5); // 41 over → 2 blocks
    expect(baseHoursForM2(250, cfg)).toBe(7.5); // §12.7-style villa
  });
});

describe('estimateHours', () => {
  it('applies the service multiplier before addons (§6 order)', () => {
    // 75 m² deep: 3.0 × 1.6 = 4.8 → + 1.0 oven = 5.8 → quarter-rounds to 5.75
    expect(
      estimateHours({ m2: 75, durationMultiplier: 1.6, addons: [oven], cfg }),
    ).toBe(5.75);
    // airbnb 0.9 on 48 m²: 2.5 × 0.9 = 2.25 (already a quarter)
    expect(estimateHours({ m2: 48, durationMultiplier: 0.9, addons: [], cfg })).toBe(2.25);
    // move_out 1.8 on 40 m²: 2.0 × 1.8 = 3.6 → 3.5
    expect(estimateHours({ m2: 40, durationMultiplier: 1.8, addons: [], cfg })).toBe(3.5);
  });

  it('sums qty-scaled addons (per_window, per_hour semantics)', () => {
    const windows = { key: 'windows', hours: 0.25, qty: 6 }; // 1.5 h
    const ironing = { key: 'ironing', hours: 1.0, qty: 2 }; // 2.0 h
    expect(
      estimateHours({ m2: 40, durationMultiplier: 1.0, addons: [windows, ironing], cfg }),
    ).toBe(5.5); // 2.0 + 1.5 + 2.0
  });

  it('rejects invalid input', () => {
    expect(() => estimateHours({ m2: 0, durationMultiplier: 1, addons: [], cfg })).toThrow(PricingError);
    expect(() => estimateHours({ m2: -5, durationMultiplier: 1, addons: [], cfg })).toThrow(PricingError);
    expect(() =>
      estimateHours({ m2: 50, durationMultiplier: 1, addons: [{ key: 'x', hours: 1, qty: 1.5 }], cfg }),
    ).toThrow(PricingError);
    expect(() =>
      estimateHours({ m2: 50, durationMultiplier: 1, addons: [{ key: 'x', hours: 1, qty: -1 }], cfg }),
    ).toThrow(PricingError);
  });
});

describe('roundToQuarter', () => {
  it('rounds halves up and is idempotent', () => {
    expect(roundToQuarter(3.125)).toBe(3.25);
    expect(roundToQuarter(3.124)).toBe(3.0);
    expect(roundToQuarter(3.874)).toBe(3.75);
    expect(roundToQuarter(3.875)).toBe(4.0);
    expect(roundToQuarter(roundToQuarter(3.874))).toBe(roundToQuarter(3.874));
  });
});

describe('price', () => {
  it('applies each recurring frequency to the §6 formula', () => {
    expect(price(4, 1200, cfg, { paymentMethod: 'card', recurring: 'biweekly' }).discountF).toBe(336); // 7 %
    expect(price(4, 1200, cfg, { paymentMethod: 'card', recurring: 'monthly' }).discountF).toBe(240); // 5 %
  });

  it('adds the cash fee only for cash', () => {
    const card = price(4, 1200, cfg, { paymentMethod: 'card' });
    const cash = price(4, 1200, cfg, { paymentMethod: 'cash' });
    expect(cash.totalF - card.totalF).toBe(200);
    expect(card.cashFeeF).toBe(0);
  });

  it('treats null cash_fee_f as 0', () => {
    const noCashFee = parsePricingConfig({ ...seedRow, cashFeeF: null });
    expect(price(4, 1200, noCashFee, { paymentMethod: 'cash' }).cashFeeF).toBe(0);
  });

  it('throws on a rate outside the city bounds — never clamps', () => {
    expect(() => price(4, 799, cfg, { paymentMethod: 'card' })).toThrow(PricingError);
    expect(() => price(4, 1501, cfg, { paymentMethod: 'card' })).toThrow(PricingError);
    expect(() => price(4, 800, cfg, { paymentMethod: 'card' })).not.toThrow();
    expect(() => price(4, 1500, cfg, { paymentMethod: 'card' })).not.toThrow();
  });

  it('handles a 0 % fee config', () => {
    const freeCfg = parsePricingConfig({ ...seedRow, platformFeePct: 0 });
    const p = price(4, 1200, freeCfg, { paymentMethod: 'card' });
    expect(p.serviceFeeF).toBe(0);
    expect(p.totalF).toBe(4800);
  });

  it('rejects fractional-fening rates and non-positive hours', () => {
    expect(() => price(4, 1200.5, cfg, { paymentMethod: 'card' })).toThrow(PricingError);
    expect(() => price(0, 1200, cfg, { paymentMethod: 'card' })).toThrow(PricingError);
  });
});

describe('parsePricingConfig', () => {
  it('rejects malformed jsonb loudly', () => {
    expect(() => parsePricingConfig({ ...seedRow, m2Bands: { bands: [] } })).toThrow(PricingConfigError);
    expect(() => parsePricingConfig({ ...seedRow, m2Bands: [1, 2, 3] })).toThrow(PricingConfigError);
    expect(() =>
      parsePricingConfig({ ...seedRow, recurringDiscountPct: { weekly: 'ten' } }),
    ).toThrow(PricingConfigError);
    expect(() => parsePricingConfig({ ...seedRow, rateMinF: 0 })).toThrow(PricingConfigError);
    expect(() => parsePricingConfig({ ...seedRow, rateMaxF: 700 })).toThrow(PricingConfigError);
    expect(() => parsePricingConfig({ ...seedRow, platformFeePct: 101 })).toThrow(PricingConfigError);
  });

  it('rejects misordered bands', () => {
    expect(() =>
      parsePricingConfig({
        ...seedRow,
        m2Bands: {
          bands: [
            { maxM2: 60, hours: 2.5 },
            { maxM2: 40, hours: 2.0 },
          ],
          extraPer40M2: 1.0,
        },
      }),
    ).toThrow(PricingConfigError);
  });
});
