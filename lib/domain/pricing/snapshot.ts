// Full quote trace (E2.1, plan §6): estimateHours + price composed into the
// object that POST /api/pricing/quote returns (E2.2) and bookings store as
// pricing_snapshot (E3) — "historical bookings never reprice" hinges on this
// being self-contained. Pure — no I/O.

import { type PricingConfigData } from './config';
import { baseHoursForM2, estimateHours, type AddonInput } from './estimateHours';
import { price, type PriceBreakdown, type PriceOptions } from './price';

export interface QuoteInput {
  m2: number;
  serviceTypeKey: string;
  durationMultiplier: number;
  addons: AddonInput[];
  rateF: number;
  cfg: PricingConfigData;
  opts: PriceOptions;
}

export interface PricingSnapshot extends PriceBreakdown {
  m2: number;
  serviceTypeKey: string;
  baseHours: number;
  durationMultiplier: number;
  addons: { key: string; hours: number; qty: number; contributionHours: number }[];
  estHours: number;
  rateF: number;
  paymentMethod: 'card' | 'cash';
  recurring: string | null;
  pricingConfigVersion: number;
}

export function buildQuote(input: QuoteInput): PricingSnapshot {
  const { m2, serviceTypeKey, durationMultiplier, addons, rateF, cfg, opts } = input;

  const estHours = estimateHours({ m2, durationMultiplier, addons, cfg });
  const breakdown = price(estHours, rateF, cfg, opts);

  return {
    m2,
    serviceTypeKey,
    baseHours: baseHoursForM2(m2, cfg),
    durationMultiplier,
    addons: addons.map((a) => ({ ...a, contributionHours: a.hours * a.qty })),
    estHours,
    rateF,
    paymentMethod: opts.paymentMethod,
    recurring: opts.recurring ?? null,
    pricingConfigVersion: cfg.version,
    ...breakdown,
  };
}
