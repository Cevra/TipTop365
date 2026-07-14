// Cleaner-rate bounds helpers (E2.4, plan §6 "min/max from city cfg").
// The pricing engine already REJECTS out-of-bounds rates at quote/booking time
// (price.ts) — these helpers are for profile forms: validate before save and
// render the hint. Pure — usable client-side with bounds from GET /api/catalog.

import { formatKM } from '@/lib/shared/format';

export interface RateBounds {
  rateMinF: number;
  rateMaxF: number;
}

export function isRateWithinBounds(rateF: number, bounds: RateBounds): boolean {
  return (
    Number.isInteger(rateF) && rateF >= bounds.rateMinF && rateF <= bounds.rateMaxF
  );
}

/** "8,00–15,00 KM" — for the profile-form hint under the rate input. */
export function rateBoundsHint(bounds: RateBounds): string {
  return `${formatKM(bounds.rateMinF)}–${formatKM(bounds.rateMaxF)}`;
}

/** Form input (KM, possibly decimal) → integer fenings for validation. */
export function kmInputToFenings(km: number): number {
  return Math.round(km * 100);
}
