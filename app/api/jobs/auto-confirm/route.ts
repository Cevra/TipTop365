import { ok, handler } from '@/lib/server/http';
import { requireCronAuth } from '@/lib/server/jobs';
import { prisma } from '@/lib/server/db';
import { applyBookingTransition } from '@/lib/server/bookings/applyTransition';

export const runtime = 'nodejs';

const DEFAULT_AUTO_CONFIRM_HOURS = 48;

/**
 * POST /api/jobs/auto-confirm (D8: Vercel Cron, hourly) — §5: bookings sitting
 * in pending_completion longer than the config's auto_confirm_hours complete
 * automatically (→ LEDGER RELEASE via the E5.2 executor). The window comes
 * from the booking's SNAPSHOTTED config version; the clock starts at the
 * `pending_completion` booking_events row (the cleaner's Finish).
 */
export const POST = handler(async (request: Request) => {
  requireCronAuth(request);
  const now = Date.now();

  const candidates = await prisma.booking.findMany({
    where: { status: 'pending_completion' },
    include: {
      property: { select: { cityId: true } },
      events: {
        where: { toStatus: 'pending_completion' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  let confirmed = 0;
  const errors: { bookingId: string; reason: string }[] = [];
  for (const booking of candidates) {
    const finishedAt = booking.events[0]?.createdAt;
    if (!finishedAt) continue; // no event trail — never auto-move it

    let hours = DEFAULT_AUTO_CONFIRM_HOURS;
    if (booking.property.cityId) {
      const cfg = await prisma.pricingConfig.findUnique({
        where: {
          cityId_version: {
            cityId: booking.property.cityId,
            version: booking.pricingConfigVersion,
          },
        },
        select: { autoConfirmHours: true },
      });
      if (cfg) hours = cfg.autoConfirmHours;
    }
    if (now - finishedAt.getTime() < hours * 3600_000) continue;

    try {
      await applyBookingTransition({
        bookingId: booking.id,
        action: 'auto_confirmed',
        actor: { type: 'system' },
        meta: { autoConfirmHours: hours, finishedAt: finishedAt.toISOString() },
      });
      confirmed++;
    } catch (err) {
      errors.push({ bookingId: booking.id, reason: err instanceof Error ? err.message : 'unknown' });
    }
  }
  return ok({ scanned: candidates.length, confirmed, errors });
});
