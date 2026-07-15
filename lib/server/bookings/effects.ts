import 'server-only';
import type { Booking } from '@prisma/client';
import type { SideEffect } from '@/lib/domain/bookingFsm';
import { refundPlan, releasePlan } from '@/lib/domain/ledger/postings';
import { post } from '@/lib/server/ledger/engine';

// FSM side-effect executor (E5.2): turns the descriptors the transition table
// returns into §7 postings (and the E3.6 rebroadcast). Runs AFTER the status
// transaction commits; every posting is idempotency-keyed, so a crashed or
// retried effect can never double-post. `release:<bookingId>` being ONE key
// also means a dispute-release after a normal release is inherently a no-op —
// the ledger cannot pay a job twice.

export interface EffectContext {
  /** Cancellation/no-show refund in fenings; defaults to the full total. */
  refundF?: number;
  /** Distinguishes refund idempotency keys per resolution path. */
  refundRef?: string;
}

export async function executeSideEffects(
  booking: Booking,
  sideEffects: SideEffect[],
  ctx: EffectContext = {},
): Promise<void> {
  for (const effect of sideEffects) {
    switch (effect) {
      case 'ledger.release': {
        await post(releasePlan(toMoney(booking)));
        break;
      }
      case 'ledger.refund': {
        // Cash bookings never captured anything — nothing to refund.
        if (booking.paymentMethod === 'cash') break;
        const refundF = ctx.refundF ?? booking.totalF;
        if (refundF < 0 || refundF > booking.totalF) break; // defensive; route validated
        await post(refundPlan(toMoney(booking), refundF, ctx.refundRef ?? booking.id));
        break;
      }
      case 'ledger.partial': {
        // Dispute partial resolution needs resolution_amount_f — E5.6 wires it.
        console.warn(`ledger.partial for booking ${booking.id} deferred to E5.6`);
        break;
      }
      case 'payout_freeze': {
        // §7: freeze = release postings simply never fire while disputed —
        // the FSM already guarantees that; nothing to post.
        break;
      }
      case 'rematch': {
        // Cleaner cancelled from accepted → back to matching (§5 note).
        const { broadcastOffers } = await import('@/lib/server/bookings/broadcast');
        try {
          await broadcastOffers(booking.id);
        } catch (err) {
          console.error('rematch broadcast failed for', booking.id, err);
        }
        break;
      }
      case 'purge_prejob_photos': {
        // Photo purge lands with E3.7/E12.1 (no photos exist to purge yet).
        break;
      }
    }
  }
}

function toMoney(booking: Booking) {
  return {
    id: booking.id,
    cleanerId: booking.cleanerId,
    cleanerAmountF: booking.cleanerAmountF,
    serviceFeeF: booking.serviceFeeF,
    cashFeeF: booking.cashFeeF,
    discountF: booking.discountF,
    totalF: booking.totalF,
    paymentMethod: booking.paymentMethod,
  };
}
