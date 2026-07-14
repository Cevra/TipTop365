// Duration estimation (E2.1, plan §6):
//   base  = band lookup from cfg.m2_bands
//   base *= serviceType.duration_multiplier   (deep 1.6, move_out 1.8, airbnb 0.9)
//   hours = base + Σ addon.hours × qty        (addons are NOT multiplied — §6 order)
//   return roundToQuarter(hours)
// Pure — no I/O.

import type { PricingConfigData } from './config';

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

/**
 * `qty` is the unit count for the addon's unit:
 *   fixed → 1, per_window → number of windows, per_hour → hours booked,
 *   per_m2 → m² units. Contribution is uniformly `hours × qty`; resolving what
 *   qty means for a unit is the caller's job (wizard/quote endpoint).
 */
export interface AddonInput {
  key: string;
  hours: number;
  qty: number;
}

/** Round to the nearest quarter hour, halves up (3.125 → 3.25). */
export function roundToQuarter(hours: number): number {
  return Math.round(hours * 4) / 4;
}

/** §6 band lookup: first band covering m2; beyond the last band, +extraPer40M2 per started 40 m². */
export function baseHoursForM2(m2: number, cfg: PricingConfigData): number {
  const band = cfg.bands.find((b) => m2 <= b.maxM2);
  if (band) return band.hours;
  const last = cfg.bands[cfg.bands.length - 1];
  const over = m2 - last.maxM2;
  return last.hours + Math.ceil(over / 40) * cfg.extraPer40M2;
}

export function estimateHours(args: {
  m2: number;
  durationMultiplier: number;
  addons: AddonInput[];
  cfg: PricingConfigData;
}): number {
  const { m2, durationMultiplier, addons, cfg } = args;

  if (!Number.isFinite(m2) || m2 <= 0) throw new PricingError(`m2 must be positive, got ${m2}`);
  if (!Number.isFinite(durationMultiplier) || durationMultiplier <= 0) {
    throw new PricingError(`durationMultiplier must be positive, got ${durationMultiplier}`);
  }
  for (const addon of addons) {
    if (!Number.isInteger(addon.qty) || addon.qty < 0) {
      throw new PricingError(`addon ${addon.key}: qty must be a non-negative integer, got ${addon.qty}`);
    }
    if (!Number.isFinite(addon.hours) || addon.hours < 0) {
      throw new PricingError(`addon ${addon.key}: hours must be non-negative, got ${addon.hours}`);
    }
  }

  const base = baseHoursForM2(m2, cfg) * durationMultiplier;
  const addonHours = addons.reduce((sum, a) => sum + a.hours * a.qty, 0);
  return roundToQuarter(base + addonHours);
}
