import 'server-only';
import { consumeToken, type BucketState, type TokenBucketOptions } from '@/lib/shared/rateLimit';

// In-memory token-bucket store. NOTE: per-instance only — correct for a single
// serverless region / dev. For multi-instance production, swap this Map for a
// shared store (Upstash Redis or a Postgres row) behind the same interface;
// the pure algorithm in lib/shared/rateLimit stays unchanged (plan §12.5).
const buckets = new Map<string, BucketState>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

/**
 * Consume one token for `key`. Returns whether the request is allowed and, if
 * not, how long to wait. Call from route handlers on sensitive endpoints
 * (auth, quote, webhook, chat).
 */
export function rateLimit(key: string, opts: TokenBucketOptions, cost = 1): RateLimitResult {
  const now = Date.now();
  const { state, allowed, retryAfterSec } = consumeToken(buckets.get(key), opts, now, cost);
  buckets.set(key, state);
  return { allowed, retryAfterSec: Math.ceil(retryAfterSec) };
}

/** Common presets. */
export const RATE_LIMITS = {
  auth: { capacity: 10, refillPerSec: 10 / 60 }, // ~10/min
  quote: { capacity: 30, refillPerSec: 30 / 60 },
  chat: { capacity: 20, refillPerSec: 20 / 60 },
  upload: { capacity: 10, refillPerSec: 10 / 60 },
} as const;

/** Test-only: clear all buckets. */
export function __resetRateLimits(): void {
  buckets.clear();
}
