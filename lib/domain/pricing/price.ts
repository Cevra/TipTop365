// Money math (E2.1, plan §6/D5). Integer fenings only — every output is an
// integer; direction of rounding is Math.round (half up) at exactly the three
// points §6 defines. Pure — no I/O.

import type { PricingConfigData, RecurringFrequency } from './config';
import { PricingError } from './estimateHours';

export interface PriceOptions {
  recurring?: RecurringFrequency;
  paymentMethod: 'card' | 'cash';
}

export interface PriceBreakdown {
  cleanerAmountF: number;
  discountPct: number;
  discountF: number;
  serviceFeePct: number;
  serviceFeeF: number;
  cashFeeF: number;
  totalF: number;
}

export function price(
  hours: number,
  rateF: number,
  cfg: PricingConfigData,
  opts: PriceOptions,
): PriceBreakdown {
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new PricingError(`hours must be positive, got ${hours}`);
  }
  if (!Number.isInteger(rateF)) {
    throw new PricingError(`rateF must be integer fenings, got ${rateF}`);
  }
  // Out-of-bounds rate = bug or tampering (server recomputes every submit, §6).
  // Never clamp silently — E2.4 owns the friendly UI-side enforcement.
  if (rateF < cfg.rateMinF || rateF > cfg.rateMaxF) {
    throw new PricingError(
      `rate ${rateF}f outside city bounds [${cfg.rateMinF}, ${cfg.rateMaxF}]`,
    );
  }

  const cleanerAmountF = Math.round(hours * rateF);

  const discountPct = opts.recurring ? cfg.recurringDiscountPct[opts.recurring] : 0;
  const discountF = Math.round((cleanerAmountF * discountPct) / 100);

  const serviceFeeF = Math.round(((cleanerAmountF - discountF) * cfg.platformFeePct) / 100);

  const cashFeeF = opts.paymentMethod === 'cash' ? cfg.cashFeeF : 0;

  return {
    cleanerAmountF,
    discountPct,
    discountF,
    serviceFeePct: cfg.platformFeePct,
    serviceFeeF,
    cashFeeF,
    totalF: cleanerAmountF - discountF + serviceFeeF + cashFeeF,
  };
}
