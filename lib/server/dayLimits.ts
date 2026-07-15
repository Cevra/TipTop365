import 'server-only';
import type { LegalRegime } from '@prisma/client';
import { prisma } from '@/lib/server/db';
import { evaluateDayLimit, usedDays, type DayLimitStatus } from '@/lib/domain/dayLimits';

// Server wrappers for the day-limit domain (E7.3). Wiring into offer
// acceptance/visibility + the warning job is E7.5; the meter UI reads
// checkDayLimit. recordWorkDay is called on acceptance per §8.3.

/**
 * Insert the engaged day. Idempotent: the unique (cleaner, work_date, year)
 * constraint makes a second same-day visit a no-op (multi-visit day = 1 day).
 */
export async function recordWorkDay(args: {
  cleanerId: string; // cleaner_profiles id (§4 ERD)
  bookingId: string;
  workDate: Date;
  regime: LegalRegime;
}): Promise<{ counted: boolean }> {
  const day = new Date(
    Date.UTC(args.workDate.getUTCFullYear(), args.workDate.getUTCMonth(), args.workDate.getUTCDate()),
  );
  try {
    await prisma.dayLimitEntry.create({
      data: {
        cleanerId: args.cleanerId,
        bookingId: args.bookingId,
        workDate: day,
        legalRegime: args.regime,
        year: day.getUTCFullYear(),
      },
    });
    return { counted: true };
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return { counted: false };
    throw err;
  }
}

/**
 * Current-year status for a cleaner under their CURRENT regime. All engaged
 * days that year count against the limit regardless of the regime they were
 * recorded under (conservative on a mid-year regime switch — the person's
 * days worked don't reset because the paperwork changed).
 */
export async function checkDayLimit(
  cleanerId: string,
  regime: LegalRegime,
  year = new Date().getUTCFullYear(),
): Promise<DayLimitStatus> {
  const entries = await prisma.dayLimitEntry.findMany({
    where: { cleanerId, year },
    select: { workDate: true, year: true },
  });
  return evaluateDayLimit({ regime, used: usedDays(entries, year) });
}
