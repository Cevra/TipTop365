import { prisma } from '@/lib/server/db';
import { ok, fail } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/health — liveness + DB connectivity (plan D21). Wire an external
 * uptime monitor (healthchecks.io / Better Uptime) to poll this; a non-200 or a
 * missed check fires the dead-man alert. Cron jobs (E8+) ping their own
 * dead-man URLs on success.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({ status: 'ok', db: 'ok' });
  } catch {
    return fail('DB_UNAVAILABLE', 503);
  }
}
