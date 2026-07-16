import { describe, expect, it } from 'vitest';
import { RATE_LIMITS } from '@/lib/server/rateLimit';

// E12.3 audit pin: every sensitive-endpoint class has a preset, and the
// money-touching ones are the tightest. Removing/loosening a preset must
// show up as a failing test, not a silent regression.
describe('rate-limit coverage (E12.3, §12.5)', () => {
  it('has a preset per sensitive endpoint class', () => {
    expect(Object.keys(RATE_LIMITS).sort()).toEqual([
      'auth',
      'booking',
      'chat',
      'payment',
      'quote',
      'search',
      'upload',
    ]);
  });

  it('payment attempts are the tightest cap', () => {
    const capacities = Object.values(RATE_LIMITS).map((l) => l.capacity);
    expect(RATE_LIMITS.payment.capacity).toBe(Math.min(...capacities));
    expect(RATE_LIMITS.payment.capacity).toBeLessThanOrEqual(5);
    expect(RATE_LIMITS.booking.capacity).toBeLessThanOrEqual(10);
  });
});
