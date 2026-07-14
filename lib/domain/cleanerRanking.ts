// Cleaner ranking (E3.3, plan §3 step 5 / §13: verified → rating → distance →
// price). Pure — the search endpoint loads candidates, this module orders them.

export interface RankableCleaner {
  tier: 'registered' | 'verified';
  ratingAvg: number | null;
  ratingCount: number;
  hourlyRateF: number | null;
  lat: number | null;
  lng: number | null;
  serviceRadiusKm: number | null;
}

export interface Origin {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in km (haversine). */
export function distanceKm(a: Origin, b: Origin): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Distance from origin, or null when either side lacks coordinates. */
export function cleanerDistanceKm(cleaner: RankableCleaner, origin: Origin | null): number | null {
  if (!origin || cleaner.lat === null || cleaner.lng === null) return null;
  return distanceKm(origin, { lat: cleaner.lat, lng: cleaner.lng });
}

/**
 * True when the cleaner serves the origin: no radius or no coordinates on
 * either side → assumed in range (data is optional in the identity block;
 * excluding on missing data would hide the whole legacy roster).
 */
export function withinServiceRadius(cleaner: RankableCleaner, origin: Origin | null): boolean {
  const d = cleanerDistanceKm(cleaner, origin);
  if (d === null || cleaner.serviceRadiusKm === null) return true;
  return d <= cleaner.serviceRadiusKm;
}

/**
 * §13 ranking. Within each criterion, missing data ranks below known data
 * (an unrated cleaner sits under any rated one of the same tier; unknown
 * distance under any known distance) — never interleaved by accident.
 */
export function compareCleaners<T extends RankableCleaner>(
  a: T,
  b: T,
  origin: Origin | null,
): number {
  // 1. Verified badge first.
  if (a.tier !== b.tier) return a.tier === 'verified' ? -1 : 1;

  // 2. Rating desc, unrated last.
  if (a.ratingAvg !== b.ratingAvg) {
    if (a.ratingAvg === null) return 1;
    if (b.ratingAvg === null) return -1;
    return b.ratingAvg - a.ratingAvg;
  }

  // 3. Distance asc, unknown last.
  const da = cleanerDistanceKm(a, origin);
  const db = cleanerDistanceKm(b, origin);
  if (da !== db) {
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  }

  // 4. Price asc, unpriced last.
  if (a.hourlyRateF !== b.hourlyRateF) {
    if (a.hourlyRateF === null) return 1;
    if (b.hourlyRateF === null) return -1;
    return a.hourlyRateF - b.hourlyRateF;
  }
  return 0;
}

export function rankCleaners<T extends RankableCleaner>(cleaners: T[], origin: Origin | null): T[] {
  return [...cleaners].sort((a, b) => compareCleaners(a, b, origin));
}
