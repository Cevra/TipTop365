import 'server-only';
import type { Booking, BookingActorType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/db';
import { ApiError } from '@/lib/server/http';
import {
  transition,
  IllegalTransitionError,
  WrongActorError,
  type BookingAction,
  type SideEffect,
} from '@/lib/domain/bookingFsm';
import { executeSideEffects, type EffectContext } from '@/lib/server/bookings/effects';

// Applies an FSM transition (E3.4): status update + append-only booking_events
// row in ONE transaction, race-safe via a status-guarded update (two competing
// transitions → exactly one wins, the other gets 409 BOOKING_STATE_CHANGED).
// Side effects are RETURNED, not executed — E5 (ledger), E3.6 (rematch) and
// E12.1 (photo purge) register their executors on top of this seam.

export interface TransitionActor {
  type: BookingActorType;
  /** users.id — null for `system` (jobs, PSP webhooks). */
  userId?: string | null;
}

export interface TransitionResult {
  booking: Booking;
  sideEffects: SideEffect[];
}

export async function applyBookingTransition(args: {
  bookingId: string;
  action: BookingAction;
  actor: TransitionActor;
  /** Stored on the event (GPS coords on check-in, cancellation reason, …). */
  meta?: Prisma.InputJsonValue;
  /** Cancellation reason — persisted onto the booking when the edge cancels it. */
  reason?: string;
  /** Passed to the E5.2 side-effect executor (refund amounts, …). */
  effectCtx?: EffectContext;
}): Promise<TransitionResult> {
  const { bookingId, action, actor, meta, reason, effectCtx } = args;

  const current = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!current) throw new ApiError('BOOKING_NOT_FOUND', 404);

  let spec;
  try {
    spec = transition(current.status, action, actor.type);
  } catch (err) {
    if (err instanceof WrongActorError) throw new ApiError('FORBIDDEN_ACTOR', 403, { action });
    if (err instanceof IllegalTransitionError) {
      throw new ApiError('ILLEGAL_TRANSITION', 409, { from: current.status, action });
    }
    throw err;
  }

  const booking = await prisma.$transaction(async (tx) => {
    // Guarded update: only wins if the status is still what we resolved the
    // transition against. count === 0 → someone else transitioned first.
    const updated = await tx.booking.updateMany({
      where: { id: bookingId, status: current.status },
      data: {
        status: spec.to,
        ...(spec.to === 'cancelled'
          ? { cancelledBy: actor.type, cancellationReason: reason ?? null }
          : {}),
      },
    });
    if (updated.count === 0) {
      throw new ApiError('BOOKING_STATE_CHANGED', 409, { expected: current.status });
    }

    await tx.bookingEvent.create({
      data: {
        bookingId,
        fromStatus: current.status,
        toStatus: spec.to,
        actorType: actor.type,
        actorId: actor.userId ?? null,
        meta,
      },
    });

    return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  });

  // Post-commit effects (E5.2): §7 postings + rematch. Idempotency-keyed, so
  // a retry after a crash here can never double-post; a hard failure leaves
  // the booking transitioned and the posting replayable by ops.
  await executeSideEffects(booking, [...spec.sideEffects], effectCtx);

  return { booking, sideEffects: [...spec.sideEffects] };
}
