// Day-limit tracking (E7.3, plan §8.3) — pure. BiH temporary/occasional-work
// regimes (§8.1): FBiH 60 days/yr, FBiH student 180 days/yr (+ ≤2 contracts/yr),
// RS 90 working days/yr, Brčko default 60 (configurable per §8), obrt —
// registered trade, NO day limit (platform self-bills instead).
// ⚠ Regulatory numbers ship watermarked like the contract templates: verify
// with the accountant/lawyer before launch (plan §8 note).

import type { LegalRegime } from '@prisma/client';

export const DAY_LIMITS: Record<LegalRegime, number | null> = {
  fbih: 60,
  fbih_student: 180,
  rs: 90,
  brcko: 60,
  obrt: null, // unlimited — self-billing path
};

/** §8.1: student regime additionally caps contracts at 2 per calendar year. */
export const STUDENT_MAX_CONTRACTS_PER_YEAR = 2;

export const WARN_THRESHOLD_PCT = 80;

export interface DayEntryLike {
  workDate: Date;
  year: number;
}

/**
 * Distinct engaged days in the calendar year. The DB's unique
 * (cleaner, work_date, year) already guarantees one row per day — the Set here
 * makes the pure function safe for arbitrary inputs too (a multi-visit day
 * counts once, §8.3).
 */
export function usedDays(entries: DayEntryLike[], year: number): number {
  const days = new Set<string>();
  for (const e of entries) {
    if (e.year === year) days.add(e.workDate.toISOString().slice(0, 10));
  }
  return days.size;
}

export interface DayLimitStatus {
  regime: LegalRegime;
  limit: number | null;
  used: number;
  /** 0–100+, null for unlimited regimes. */
  pct: number | null;
  warn: boolean; // ≥ 80 %
  blocked: boolean; // ≥ 100 % — §8.3: offer hidden / acceptance rejected
  remainingDays: number | null;
}

export function evaluateDayLimit(args: {
  regime: LegalRegime;
  used: number;
  /** Brčko is admin-configurable (§8.1); override wins when provided. */
  limitOverride?: number | null;
}): DayLimitStatus {
  const limit = args.limitOverride !== undefined ? args.limitOverride : DAY_LIMITS[args.regime];
  if (limit === null) {
    return {
      regime: args.regime,
      limit: null,
      used: args.used,
      pct: null,
      warn: false,
      blocked: false,
      remainingDays: null,
    };
  }
  const pct = Math.round((args.used / limit) * 100);
  return {
    regime: args.regime,
    limit,
    used: args.used,
    pct,
    warn: pct >= WARN_THRESHOLD_PCT,
    blocked: args.used >= limit,
    remainingDays: Math.max(0, limit - args.used),
  };
}

/** §8.1 student rule: a THIRD contract in a year is not allowed. */
export function studentContractAllowed(contractsThisYear: number): boolean {
  return contractsThisYear < STUDENT_MAX_CONTRACTS_PER_YEAR;
}

/**
 * Would adding `date` consume a new day? (Same-day second visit doesn't.)
 * Callers use this to pre-check acceptance without inserting.
 */
export function wouldConsumeDay(entries: DayEntryLike[], date: Date): boolean {
  const key = date.toISOString().slice(0, 10);
  const year = date.getUTCFullYear();
  return !entries.some(
    (e) => e.year === year && e.workDate.toISOString().slice(0, 10) === key,
  );
}
