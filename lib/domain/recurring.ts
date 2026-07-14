// Recurring-plan date math (E3.10, plan §5 note: "materialized by the daily
// job 14 days ahead, one bookings row each"). Pure.

import type { RecurringFrequency } from '@prisma/client';

export const MATERIALIZE_HORIZON_DAYS = 14;

/** Next occurrence after `from` for the plan's cadence. Monthly clamps to the
 * shorter month's last day (Jan 31 → Feb 28) instead of skipping into March. */
export function nextRunDate(frequency: RecurringFrequency, from: Date): Date {
  const next = new Date(from.getTime());
  if (frequency === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === 'biweekly') next.setUTCDate(next.getUTCDate() + 14);
  else {
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(day, lastDay));
  }
  return next;
}

/** A plan is due when its next occurrence falls inside the horizon window. */
export function isDue(planNextRunDate: Date, now: Date, horizonDays = MATERIALIZE_HORIZON_DAYS): boolean {
  return planNextRunDate.getTime() <= now.getTime() + horizonDays * 86_400_000;
}
