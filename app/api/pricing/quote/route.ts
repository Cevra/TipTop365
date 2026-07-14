import { z } from 'zod';
import { ok, fail, handler } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/server/rateLimit';
import { clientIp } from '@/lib/server/requestIp';
import { computeQuote } from '@/lib/server/pricing';

export const runtime = 'nodejs';

const bodySchema = z.object({
  citySlug: z.string().min(1),
  serviceTypeKey: z.string().min(1),
  m2: z.number().int().positive().max(2000),
  addons: z.array(z.object({ key: z.string().min(1), qty: z.number().int().min(0).max(100) })).default([]),
  paymentMethod: z.enum(['card', 'cash']),
  recurring: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
  rateF: z.number().int().positive().optional(),
});

/**
 * POST /api/pricing/quote (plan §10, E2.2) — public wizard live-quote.
 * Server-computed only (§6: client-sent prices are never trusted); returns the
 * full PricingSnapshot trace. With `rateF` (chosen cleaner) → exact quote;
 * without → min–max range from the city's rate bounds (pre-selection /
 * broadcast matching, where the cleaner's rate is not yet known).
 * Rate-limited per IP (quote preset).
 */
export const POST = handler(async (request: Request) => {
  const { allowed, retryAfterSec } = rateLimit(`quote:${clientIp(request)}`, RATE_LIMITS.quote);
  if (!allowed) return fail('RATE_LIMITED', 429, { retryAfterSec });

  const body = await parseBody(request, bodySchema);
  const result = await computeQuote(body);
  return ok(result);
});
