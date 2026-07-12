import { describe, expect, it } from 'vitest';
import { consumeToken, type BucketState } from '@/lib/shared/rateLimit';

const opts = { capacity: 3, refillPerSec: 1 };

describe('consumeToken', () => {
  it('starts full: first call allowed, tokens decremented', () => {
    const r = consumeToken(undefined, opts, 1000);
    expect(r.allowed).toBe(true);
    expect(r.state.tokens).toBe(2);
  });

  it('blocks once the bucket is empty', () => {
    let state: BucketState | undefined;
    let last;
    for (let i = 0; i < 3; i++) {
      last = consumeToken(state, opts, 1000);
      state = last.state;
      expect(last.allowed).toBe(true);
    }
    const blocked = consumeToken(state, opts, 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('refills over elapsed time up to capacity', () => {
    // Drain to 0 at t=1000ms
    let state: BucketState = { tokens: 0, updatedAt: 1000 };
    // 2s later → +2 tokens
    const r = consumeToken(state, opts, 3000);
    expect(r.allowed).toBe(true);
    expect(r.state.tokens).toBeCloseTo(1); // 2 refilled - 1 consumed
  });

  it('never exceeds capacity after a long idle', () => {
    const state: BucketState = { tokens: 0, updatedAt: 0 };
    const r = consumeToken(state, opts, 1_000_000); // huge gap
    expect(r.state.tokens).toBeLessThanOrEqual(opts.capacity);
  });

  it('reports retryAfter based on refill rate', () => {
    const empty: BucketState = { tokens: 0, updatedAt: 1000 };
    const r = consumeToken(empty, opts, 1000); // need 1 token, refill 1/s
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBeCloseTo(1);
  });
});
