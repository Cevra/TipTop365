import { describe, expect, it } from 'vitest';
import {
  cleanerDistanceKm,
  compareCleaners,
  distanceKm,
  rankCleaners,
  withinServiceRadius,
  type RankableCleaner,
} from '@/lib/domain/cleanerRanking';

const SARAJEVO = { lat: 43.8563, lng: 18.4131 };
const BANJA_LUKA = { lat: 44.7722, lng: 17.191 };

function cleaner(overrides: Partial<RankableCleaner>): RankableCleaner {
  return {
    tier: 'registered',
    ratingAvg: null,
    ratingCount: 0,
    hourlyRateF: 1000,
    lat: null,
    lng: null,
    serviceRadiusKm: null,
    ...overrides,
  };
}

describe('distanceKm', () => {
  it('haversine sanity: Sarajevo ↔ Banja Luka ≈ 140–150 km', () => {
    const d = distanceKm(SARAJEVO, BANJA_LUKA);
    expect(d).toBeGreaterThan(130);
    expect(d).toBeLessThan(160);
    expect(distanceKm(SARAJEVO, SARAJEVO)).toBe(0);
  });
});

describe('ranking order (§13: verified → rating → distance → price)', () => {
  it('verified beats everything', () => {
    const verified = cleaner({ tier: 'verified', ratingAvg: 3.0, hourlyRateF: 1500 });
    const registered = cleaner({ tier: 'registered', ratingAvg: 5.0, hourlyRateF: 800 });
    expect(rankCleaners([registered, verified], null)[0]).toBe(verified);
  });

  it('within a tier, higher rating wins; unrated sits below rated', () => {
    const high = cleaner({ ratingAvg: 4.9 });
    const low = cleaner({ ratingAvg: 4.1 });
    const unrated = cleaner({ ratingAvg: null });
    expect(rankCleaners([unrated, low, high], null)).toEqual([high, low, unrated]);
  });

  it('equal tier+rating: nearer wins; unknown distance last', () => {
    const near = cleaner({ ratingAvg: 4.5, lat: 43.86, lng: 18.42 });
    const far = cleaner({ ratingAvg: 4.5, lat: 43.95, lng: 18.6 });
    const unknown = cleaner({ ratingAvg: 4.5 });
    expect(rankCleaners([unknown, far, near], SARAJEVO)).toEqual([near, far, unknown]);
  });

  it('final tiebreak is price ascending; unpriced last', () => {
    const cheap = cleaner({ hourlyRateF: 900 });
    const dear = cleaner({ hourlyRateF: 1400 });
    const unpriced = cleaner({ hourlyRateF: null });
    expect(rankCleaners([unpriced, dear, cheap], null)).toEqual([cheap, dear, unpriced]);
  });

  it('is a proper comparator: antisymmetric and self-zero', () => {
    const a = cleaner({ tier: 'verified', ratingAvg: 4.5 });
    const b = cleaner({ ratingAvg: 4.9 });
    expect(compareCleaners(a, b, null)).toBeLessThan(0);
    expect(compareCleaners(b, a, null)).toBeGreaterThan(0);
    expect(compareCleaners(a, a, null)).toBe(0);
  });
});

describe('service radius', () => {
  it('excludes cleaners whose radius does not reach the origin', () => {
    const tight = cleaner({ lat: 43.95, lng: 18.6, serviceRadiusKm: 5 });
    expect(withinServiceRadius(tight, SARAJEVO)).toBe(false);
    const wide = cleaner({ lat: 43.95, lng: 18.6, serviceRadiusKm: 30 });
    expect(withinServiceRadius(wide, SARAJEVO)).toBe(true);
  });

  it('missing coordinates or radius → assumed in range (legacy data is sparse)', () => {
    expect(withinServiceRadius(cleaner({}), SARAJEVO)).toBe(true);
    expect(withinServiceRadius(cleaner({ lat: 43.9, lng: 18.4 }), null)).toBe(true);
    expect(withinServiceRadius(cleaner({ lat: 43.9, lng: 18.4, serviceRadiusKm: 1 }), null)).toBe(true);
  });

  it('cleanerDistanceKm is null without both coordinate sides', () => {
    expect(cleanerDistanceKm(cleaner({}), SARAJEVO)).toBeNull();
    expect(cleanerDistanceKm(cleaner({ lat: 43.9, lng: 18.4 }), null)).toBeNull();
    expect(cleanerDistanceKm(cleaner({ lat: 43.9, lng: 18.4 }), SARAJEVO)).toBeGreaterThan(0);
  });
});
