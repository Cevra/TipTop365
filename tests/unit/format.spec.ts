import { describe, expect, it } from 'vitest';
import { formatKM, formatKMFromDecimal, formatDateBs, formatDateTimeBs } from '@/lib/shared/format';

describe('formatKM', () => {
  it.each([
    [0, '0,00 KM'],
    [5760, '57,60 KM'],
    [960, '9,60 KM'],
    [5, '0,05 KM'],
    [100, '1,00 KM'],
    [123456, '1.234,56 KM'],
    [100000000, '1.000.000,00 KM'],
  ])('%d fenings → %s', (f, expected) => {
    expect(formatKM(f)).toBe(expected);
  });

  it('renders negatives with a minus sign (wallet debt)', () => {
    expect(formatKM(-960)).toBe('−9,60 KM');
    expect(formatKM(-5000)).toBe('−50,00 KM');
  });

  it('formatKMFromDecimal matches the worked example (plan §6)', () => {
    expect(formatKMFromDecimal(57.6)).toBe('57,60 KM');
    expect(formatKMFromDecimal(51.84)).toBe('51,84 KM');
  });
});

describe('date formatting', () => {
  it('formats d.M.yyyy. (bs)', () => {
    expect(formatDateBs(new Date(2026, 6, 12))).toBe('12.7.2026.');
    expect(formatDateBs(new Date(2026, 0, 5))).toBe('5.1.2026.');
  });

  it('formats date + time', () => {
    expect(formatDateTimeBs(new Date(2026, 6, 12, 14, 5))).toBe('12.7.2026. 14:05');
    expect(formatDateTimeBs(new Date(2026, 6, 12, 9, 0))).toBe('12.7.2026. 09:00');
  });
});
