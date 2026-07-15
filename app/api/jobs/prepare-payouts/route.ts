import { ok, handler, ApiError } from '@/lib/server/http';
import { requireCronAuth } from '@/lib/server/jobs';
import { isoWeekLabel, preparePayoutRun } from '@/lib/server/payouts';

export const runtime = 'nodejs';

/**
 * POST /api/jobs/prepare-payouts (D8: Vercel Cron, Fridays) — drafts the
 * current ISO week's run; the admin exports/marks-paid from /admin/payouts.
 * Already-prepared weeks are a clean no-op (cron retries are harmless).
 */
export const POST = handler(async (request: Request) => {
  requireCronAuth(request);
  try {
    const { run, skipped } = await preparePayoutRun(isoWeekLabel(), null);
    return ok({ prepared: true, runId: run.id, payouts: run.payouts.length, skipped });
  } catch (err) {
    if (err instanceof ApiError && err.code === 'RUN_EXISTS') {
      return ok({ prepared: false, reason: 'RUN_EXISTS' });
    }
    throw err;
  }
});
