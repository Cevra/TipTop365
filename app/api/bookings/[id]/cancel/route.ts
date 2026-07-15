import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { applyBookingTransition } from '@/lib/server/bookings/applyTransition';
import { getPaymentProvider } from '@/lib/server/payments/mockProvider';
import {
  computeRefundF,
  parseCancellationRules,
  resolveRefundPct,
} from '@/lib/domain/cancellation';

export const runtime = 'nodejs';

const bodySchema = z.object({ reason: z.string().min(1).max(300).optional() });

type Ctx = { params: { id: string } };

/**
 * POST /api/bookings/:id/cancel (§10) — customer cancellation with the
 * SNAPSHOTTED config version's rules (§6: old bookings never reprice):
 * `matching` cancels free (§5 edge annotation — 100 % regardless of timing);
 * `accepted` refunds per the hours-before tiers. Card refunds go through the
 * PaymentProvider (mock now) and land as a `payments` row; the §7 ledger
 * postings arrive with E5. Cash bookings have nothing captured to refund.
 */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const user = await requireDbUser(await requireSession());
  const { reason } = await parseBody(request, bodySchema);

  const booking = await prisma.booking.findFirst({
    where: { id: params.id, customerId: user.id },
    include: { property: true },
  });
  if (!booking) throw new ApiError('BOOKING_NOT_FOUND', 404);

  let refundPct: number;
  if (booking.status === 'matching') {
    refundPct = 100; // §5: "matching → cancelled : customer cancels (free)"
  } else if (booking.status === 'accepted') {
    const configRow = await prisma.pricingConfig.findUnique({
      where: {
        cityId_version: {
          cityId: booking.property.cityId ?? '',
          version: booking.pricingConfigVersion,
        },
      },
    });
    if (!configRow) throw new ApiError('PRICING_CONFIG_NOT_FOUND', 500);
    const rules = parseCancellationRules(configRow.cancellationRules);
    const hoursBeforeSlot = (booking.scheduledAt.getTime() - Date.now()) / 3600_000;
    refundPct = resolveRefundPct(rules, { hoursBeforeSlot });
  } else {
    // draft/pending_payment abandonments and post-start states are not
    // customer-cancellable here — the FSM would reject them anyway; fail fast
    // with the same stable code.
    throw new ApiError('ILLEGAL_TRANSITION', 409, { from: booking.status, action: 'cancel' });
  }

  const refundF = computeRefundF(booking.totalF, refundPct);

  const { booking: cancelled } = await applyBookingTransition({
    bookingId: booking.id,
    action: 'customer_cancelled',
    actor: { type: 'customer', userId: user.id },
    reason,
    meta: { refundPct, refundF },
    // E5.2: the ledger.refund effect posts escrow→cash (refund) and the kept
    // penalty escrow→revenue with this exact amount.
    effectCtx: { refundF, refundRef: `cancel:${booking.id}` },
  });

  // Refund the captured card payment (§6 rules); mock provider now, Monri later.
  let refundPayment = null;
  if (booking.paymentMethod === 'card' && refundF > 0) {
    const capture = await prisma.payment.findFirst({
      where: { bookingId: booking.id, kind: 'capture', status: 'succeeded' },
      orderBy: { createdAt: 'desc' },
    });
    if (capture) {
      const provider = getPaymentProvider();
      const result = await provider.refund({
        idempotencyKey: `refund:${booking.id}`,
        providerRef: capture.providerRef ?? '',
        amountF: refundF,
      });
      refundPayment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          provider: provider.name,
          providerRef: result.providerRef,
          kind: 'refund',
          status: result.status,
          amountF: refundF,
        },
      });
    }
  }

  return ok({ booking: cancelled, refundPct, refundF, refund: refundPayment });
});
