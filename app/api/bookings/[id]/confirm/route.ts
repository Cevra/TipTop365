import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { isEnabled } from '@/lib/server/featureFlags';
import { getPaymentProvider } from '@/lib/server/payments/mockProvider';
import { applyBookingTransition } from '@/lib/server/bookings/applyTransition';
import { broadcastOffers } from '@/lib/server/bookings/broadcast';

// Best-effort offer dispatch on entering matching (E3.6). Failure must not
// undo a successful payment — the expire-offers cron and admin tooling can
// re-broadcast; the booking is already safely in matching.
async function tryBroadcast(bookingId: string, matchingMode: string): Promise<void> {
  if (matchingMode !== 'broadcast') return;
  try {
    await broadcastOffers(bookingId);
  } catch (err) {
    console.error('broadcastOffers failed for', bookingId, err);
  }
}

export const runtime = 'nodejs';

const bodySchema = z.object({
  // The e-accept (§3 step 8). The generated PDF contract + hash arrive with
  // E7.2 — until then acceptance is recorded on the booking event (stub per
  // the E3.5 task row), and the FSM edge is the same one E7 will keep using.
  acceptContract: z.literal(true),
  cardToken: z.string().min(1).optional(),
});

type Ctx = { params: { id: string } };

/**
 * POST /api/bookings/:id/confirm (§10) — accept contract + pay (D7: immediate
 * capture). draft → pending_payment → matching on success. A declined card
 * leaves the booking in pending_payment for retry (the 1 h abandonment job
 * fires `payment_abandoned` later — §5's failure edge is for definitive ends,
 * not first declines). Cash (flag-gated) skips capture: "cash allowed" (§5).
 */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const user = await requireDbUser(await requireSession());
  const body = await parseBody(request, bodySchema);

  const booking = await prisma.booking.findFirst({
    where: { id: params.id, customerId: user.id },
  });
  if (!booking) throw new ApiError('BOOKING_NOT_FOUND', 404);

  // draft → record the contract acceptance; pending_payment → this is a
  // payment retry, acceptance already on file. Anything else → FSM will 409.
  if (booking.status === 'draft') {
    await applyBookingTransition({
      bookingId: booking.id,
      action: 'contract_accepted',
      actor: { type: 'customer', userId: user.id },
      meta: { contractStub: true, acceptedAt: new Date().toISOString() },
    });
  } else if (booking.status !== 'pending_payment') {
    throw new ApiError('ILLEGAL_TRANSITION', 409, { from: booking.status, action: 'confirm' });
  }

  if (booking.paymentMethod === 'cash') {
    if (!(await isEnabled('CASH_PAYMENTS_ENABLED'))) {
      throw new ApiError('CASH_PAYMENTS_DISABLED', 403);
    }
    const { booking: updated } = await applyBookingTransition({
      bookingId: booking.id,
      action: 'payment_secured',
      actor: { type: 'system' },
      meta: { method: 'cash' },
    });
    await tryBroadcast(updated.id, updated.matchingMode);
    return ok({ booking: updated, payment: null });
  }

  // Card (D7: capture now). Idempotency key is per attempt so a retry with a
  // new card isn't swallowed by the provider's replay cache.
  const attempt = (await prisma.payment.count({ where: { bookingId: booking.id, kind: 'capture' } })) + 1;
  const provider = getPaymentProvider();
  const result = await provider.capture({
    idempotencyKey: `capture:${booking.id}:${attempt}`,
    amountF: booking.totalF,
    currency: 'BAM',
    cardToken: body.cardToken,
    reference: booking.code,
  });

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      provider: provider.name,
      providerRef: result.providerRef,
      kind: 'capture',
      status: result.status,
      amountF: booking.totalF,
      cardToken: body.cardToken ?? null,
      threedsStatus: result.threedsStatus ?? null,
    },
  });

  if (!result.ok) {
    // Stays in pending_payment — customer may retry with another card (§20.6
    // error copy lives client-side; the code is the stable contract).
    throw new ApiError('PAYMENT_DECLINED', 402, {
      reason: result.declineReason,
      paymentId: payment.id,
    });
  }

  const { booking: updated } = await applyBookingTransition({
    bookingId: booking.id,
    action: 'payment_secured',
    actor: { type: 'system' },
    meta: { method: 'card', paymentId: payment.id, providerRef: result.providerRef },
  });
  await tryBroadcast(updated.id, updated.matchingMode);
  return ok({ booking: updated, payment });
});
