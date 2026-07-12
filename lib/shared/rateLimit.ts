// Pure token-bucket algorithm (plan §12.5). No I/O, no clock — `now` is passed
// in — so it is fully deterministic and unit-tested. The server wrapper
// (lib/server/rateLimit) supplies the clock and the storage.

export interface BucketState {
  tokens: number;
  updatedAt: number; // epoch ms of last update
}

export interface TokenBucketOptions {
  capacity: number; // max tokens (burst)
  refillPerSec: number; // steady-state rate
}

export interface ConsumeResult {
  state: BucketState;
  allowed: boolean;
  /** Seconds until `cost` tokens are available (0 when allowed). */
  retryAfterSec: number;
}

export function consumeToken(
  prev: BucketState | undefined,
  opts: TokenBucketOptions,
  now: number,
  cost = 1,
): ConsumeResult {
  const { capacity, refillPerSec } = opts;
  const last = prev?.updatedAt ?? now;
  const elapsedSec = Math.max(0, (now - last) / 1000);
  const tokens = Math.min(capacity, (prev?.tokens ?? capacity) + elapsedSec * refillPerSec);

  if (tokens >= cost) {
    return { state: { tokens: tokens - cost, updatedAt: now }, allowed: true, retryAfterSec: 0 };
  }
  const deficit = cost - tokens;
  const retryAfterSec = refillPerSec > 0 ? deficit / refillPerSec : Infinity;
  return { state: { tokens, updatedAt: now }, allowed: false, retryAfterSec };
}
