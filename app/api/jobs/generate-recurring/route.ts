import { ok, handler } from '@/lib/server/http';
import { requireCronAuth } from '@/lib/server/jobs';
import { generateRecurringBookings } from '@/lib/server/bookings/generateRecurring';

export const runtime = 'nodejs';

/**
 * POST /api/jobs/generate-recurring (D8: Vercel Cron, daily) — materializes
 * recurring plans 14 days ahead (§5 note), one draft booking per occurrence.
 */
export const POST = handler(async (request: Request) => {
  requireCronAuth(request);
  return ok(await generateRecurringBookings());
});
