import { describe, expect, it } from 'vitest';
import { isRateWithinBounds, kmInputToFenings, rateBoundsHint } from '@/lib/domain/pricing';

const bounds = { rateMinF: 800, rateMaxF: 1500 };

describe('isRateWithinBounds (E2.4)', () => {
  it('accepts the bounds inclusively', () => {
    expect(isRateWithinBounds(800, bounds)).toBe(true);
    expect(isRateWithinBounds(1500, bounds)).toBe(true);
    expect(isRateWithinBounds(1200, bounds)).toBe(true);
  });

  it('rejects outside and non-integer rates', () => {
    expect(isRateWithinBounds(799, bounds)).toBe(false);
    expect(isRateWithinBounds(1501, bounds)).toBe(false);
    expect(isRateWithinBounds(1200.5, bounds)).toBe(false);
    expect(isRateWithinBounds(0, bounds)).toBe(false);
    expect(isRateWithinBounds(-800, bounds)).toBe(false);
  });
});

describe('kmInputToFenings', () => {
  it('converts form KM input incl. float-hostile decimals', () => {
    expect(kmInputToFenings(12)).toBe(1200);
    expect(kmInputToFenings(12.5)).toBe(1250);
    expect(kmInputToFenings(14.99)).toBe(1499);
  });
});

describe('rateBoundsHint', () => {
  it('renders the launch range as formatted KM', () => {
    expect(rateBoundsHint(bounds)).toBe('8,00 KM–15,00 KM');
  });
});
