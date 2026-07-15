// Posting plans (E5.1) — pure builders, one per §7 posting-map row. A plan is
// a balanced transaction: every entry is a (debit account, credit account,
// amount) pair, so Σdebit = Σcredit holds by construction; validatePlan
// enforces it anyway (defense against future hand-built plans) plus the
// amount_f > 0 integer invariant the schema can't express.

import type { LedgerEntryKind } from '@prisma/client';
import {
  CUSTOMER_ESCROW,
  PLATFORM_CASH,
  PLATFORM_REVENUE,
  cleanerPayable,
  cleanerReceivable,
  type AccountRef,
} from './accounts';

export interface PlanEntry {
  debit: AccountRef;
  credit: AccountRef;
  amountF: number;
  kind: LedgerEntryKind;
  memo?: string;
}

export interface PostingPlan {
  /** Also the txId. Replays are engine-level no-ops (§7 webhook safety). */
  idempotencyKey: string;
  bookingId?: string;
  payoutId?: string;
  entries: PlanEntry[];
}

export class InvalidPostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPostingError';
  }
}

export function validatePlan(plan: PostingPlan): void {
  if (!plan.idempotencyKey) throw new InvalidPostingError('idempotencyKey required');
  if (plan.entries.length === 0) throw new InvalidPostingError('plan has no entries');
  let debits = 0;
  let credits = 0;
  for (const e of plan.entries) {
    if (!Number.isInteger(e.amountF) || e.amountF <= 0) {
      throw new InvalidPostingError(`amountF must be a positive integer, got ${e.amountF}`);
    }
    if (e.debit.type === e.credit.type && e.debit.ownerId === e.credit.ownerId) {
      throw new InvalidPostingError('debit and credit account are identical');
    }
    debits += e.amountF;
    credits += e.amountF;
  }
  // Pairwise entries are balanced by construction — this guards refactors.
  if (debits !== credits) throw new InvalidPostingError('Σdebit ≠ Σcredit');
}

interface BookingMoney {
  id: string;
  cleanerId: string | null;
  cleanerAmountF: number;
  serviceFeeF: number;
  cashFeeF: number;
  discountF: number;
  totalF: number;
  paymentMethod: 'card' | 'cash';
}

/** §7: Card captured — platform_cash D / customer_escrow C, total. */
export function capturePlan(booking: BookingMoney, paymentId: string): PostingPlan {
  return {
    idempotencyKey: `capture:${paymentId}`,
    bookingId: booking.id,
    entries: [
      {
        debit: PLATFORM_CASH,
        credit: CUSTOMER_ESCROW,
        amountF: booking.totalF,
        kind: 'capture',
        memo: 'Card captured (D7 immediate capture)',
      },
    ],
  };
}

/**
 * §7: Job released (confirm / 48 h auto).
 * Card: escrow → cleaner_payable (cleaner_amount − discount) + escrow →
 * platform_revenue (service_fee + cash_fee).
 * Cash: nothing was captured — the §7 "cash job completed" row applies
 * instead: cleaner_receivable D / platform_revenue C for the fee (the cleaner
 * collected the full amount in cash and owes the commission).
 */
export function releasePlan(booking: BookingMoney): PostingPlan {
  if (!booking.cleanerId) throw new InvalidPostingError('release requires an assigned cleaner');
  if (booking.paymentMethod === 'cash') {
    return {
      idempotencyKey: `release:${booking.id}`,
      bookingId: booking.id,
      entries: [
        {
          debit: cleanerReceivable(booking.cleanerId),
          credit: PLATFORM_REVENUE,
          amountF: booking.serviceFeeF + booking.cashFeeF,
          kind: 'cash_commission',
          memo: 'Cash job completed — commission owed (§7)',
        },
      ],
    };
  }
  return {
    idempotencyKey: `release:${booking.id}`,
    bookingId: booking.id,
    entries: [
      {
        debit: CUSTOMER_ESCROW,
        credit: cleanerPayable(booking.cleanerId),
        amountF: booking.cleanerAmountF - booking.discountF,
        kind: 'release',
        memo: 'Job released to cleaner wallet',
      },
      {
        debit: CUSTOMER_ESCROW,
        credit: PLATFORM_REVENUE,
        amountF: booking.serviceFeeF + booking.cashFeeF,
        kind: 'fee',
        memo: 'Service fee recognized',
      },
    ],
  };
}

/**
 * §7: Refund per cancellation rules — escrow → platform_cash for the refunded
 * part. The kept remainder (late-cancel penalty) goes to platform_revenue.
 * ⚠ §7 says the kept part is "split cleaner/revenue per config", but no such
 * config column exists yet (flagged plan gap) — conservatively the whole
 * penalty is recognized as revenue; compensating an assigned cleaner later is
 * an explicit `adjustment` posting once the split is decided. Never invents a
 * payout.
 */
export function refundPlan(
  booking: BookingMoney,
  refundF: number,
  refundRef: string,
): PostingPlan {
  if (refundF < 0 || refundF > booking.totalF) {
    throw new InvalidPostingError(`refundF ${refundF} outside [0, ${booking.totalF}]`);
  }
  const keptF = booking.totalF - refundF;
  const entries: PlanEntry[] = [];
  if (refundF > 0) {
    entries.push({
      debit: CUSTOMER_ESCROW,
      credit: PLATFORM_CASH,
      amountF: refundF,
      kind: 'refund',
      memo: 'Refund per cancellation rules',
    });
  }
  if (keptF > 0) {
    entries.push({
      debit: CUSTOMER_ESCROW,
      credit: PLATFORM_REVENUE,
      amountF: keptF,
      kind: 'adjustment',
      memo: 'Cancellation penalty kept (split config pending — see E5.2 notes)',
    });
  }
  if (entries.length === 0) throw new InvalidPostingError('refund plan would be empty');
  return { idempotencyKey: `refund:${refundRef}`, bookingId: booking.id, entries };
}

/**
 * E5.6: dispute PARTIAL resolution — refund X to the customer, distribute the
 * remainder cleaner-first: the cleaner's earned share (cleaner_amount −
 * discount) is filled before the platform takes any fee, i.e. the platform
 * absorbs the shortfall (worker-protective; documented decision — the §7
 * "split per config" column still doesn't exist).
 */
export function partialPlan(booking: BookingMoney, refundF: number): PostingPlan {
  if (!booking.cleanerId) throw new InvalidPostingError('partial resolution requires a cleaner');
  if (!Number.isInteger(refundF) || refundF <= 0 || refundF >= booking.totalF) {
    throw new InvalidPostingError(
      `partial refund must be inside (0, ${booking.totalF}), got ${refundF} — use release/refund for the edges`,
    );
  }
  const remainderF = booking.totalF - refundF;
  const cleanerShareF = Math.min(remainderF, booking.cleanerAmountF - booking.discountF);
  const revenueShareF = remainderF - cleanerShareF;

  const entries: PlanEntry[] = [
    {
      debit: CUSTOMER_ESCROW,
      credit: PLATFORM_CASH,
      amountF: refundF,
      kind: 'refund',
      memo: 'Dispute partial: customer refund',
    },
    {
      debit: CUSTOMER_ESCROW,
      credit: cleanerPayable(booking.cleanerId),
      amountF: cleanerShareF,
      kind: 'dispute_release',
      memo: 'Dispute partial: cleaner share (cleaner-first waterfall)',
    },
  ];
  if (revenueShareF > 0) {
    entries.push({
      debit: CUSTOMER_ESCROW,
      credit: PLATFORM_REVENUE,
      amountF: revenueShareF,
      kind: 'fee',
      memo: 'Dispute partial: platform share',
    });
  }
  return { idempotencyKey: `release:${booking.id}`, bookingId: booking.id, entries };
}

/** §7: Cleaner top-up — platform_cash D / cleaner_receivable C. */
export function topupPlan(cleanerId: string, amountF: number, paymentId: string): PostingPlan {
  return {
    idempotencyKey: `topup:${paymentId}`,
    entries: [
      {
        debit: PLATFORM_CASH,
        credit: cleanerReceivable(cleanerId),
        amountF,
        kind: 'topup',
        memo: 'Cash-debt top-up',
      },
    ],
  };
}

/** §7: Weekly payout — cleaner_payable D / platform_cash C. */
export function payoutPlan(cleanerId: string, amountF: number, payoutId: string): PostingPlan {
  return {
    idempotencyKey: `payout:${payoutId}`,
    payoutId,
    entries: [
      {
        debit: cleanerPayable(cleanerId),
        credit: PLATFORM_CASH,
        amountF,
        kind: 'payout',
        memo: 'Weekly payout run',
      },
    ],
  };
}
