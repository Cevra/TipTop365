import 'server-only';
import { ApiError } from '@/lib/server/http';

// Cron-job auth (D8: Vercel Cron → /api/jobs/*). Vercel sends
// `Authorization: Bearer ${CRON_SECRET}` when the env var is set; local /
// manual runs pass the same header. No secret configured → jobs are disabled
// (fail loudly rather than run unauthenticated).
export function requireCronAuth(request: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ApiError('CRON_DISABLED', 503);
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    throw new ApiError('UNAUTHENTICATED', 401);
  }
}
