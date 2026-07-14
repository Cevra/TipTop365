import { ok, handler } from '@/lib/server/http';
import { requireCronAuth } from '@/lib/server/jobs';
import { expireMatching } from '@/lib/server/bookings/broadcast';

export const runtime = 'nodejs';

/**
 * POST /api/jobs/expire-offers (D8: Vercel Cron, every 15 min) — flips open
 * offers past expiry and times out matchings closer than slot − 6 h (§5).
 */
export const POST = handler(async (request: Request) => {
  requireCronAuth(request);
  return ok(await expireMatching());
});
