import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { getPaymentProvider } from '@/lib/server/payments/mockProvider';
import { adjustmentCapturePlan } from '@/lib/domain/ledger/postings';
import { post } from '@/lib/server/ledger/engine';
import { snapshotFeePct } from '@/lib/server/bookings/adjustments';

export const runtime = 'nodejs';

const bodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  cardToken: z.string().min(1).optional(),
});

type Ctx = { params: { id: string; adjId: string } };

/**
 * POST /api/bookings/:id/adjustments/:adjId (E4.7, §5 "customer must approve
 * before extra work") — approve captures the delta (card) and moves the
 * booking's money columns; reject leaves everything untouched. A declined
 * delta capture keeps the request open for retry, mirroring confirm.
 */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const user = await requireDbUser(await requireSession());
  const { action, cardToken } = await parseBody(request, bodySchema);

  const adjustment = await prisma.priceAdjustment.findFirst({
    where: { id: params.adjId, bookingId: params.id },
    include: { booking: true },
  });
  if (!adjustment || adjustment.booking.customerId !== user.id) {
    throw new ApiError('ADJUSTMENT_NOT_FOUND', 404);
  }
  if (adjustment.status !== 'requested') {
    throw new ApiError('ADJUSTMENT_NOT_OPEN', 409, { status: adjustment.status });
  }
  const booking = adjustment.booking;

  if (action === 'reject') {
    const rejected = await prisma.priceAdjustment.update({
      where: { id: adjustment.id },
      data: { status: 'rejected' },
    });
    return ok({ adjustment: rejected });
  }

  // Approve: capture the delta first (card), then move the money columns.
  if (booking.paymentMethod === 'card') {
    const provider = getPaymentProvider();
    const result = await provider.capture({
      idempotencyKey: `capture:adjustment:${adjustment.id}`,
      amountF: adjustment.extraAmountF,
      currency: 'BAM',
      cardToken,
      reference: `${booking.code} +${adjustment.extraHours}h`,
    });
    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        provider: provider.name,
        providerRef: result.providerRef,
        kind: 'capture',
        status: result.status,
        amountF: adjustment.extraAmountF,
        cardToken: cardToken ?? null,
      },
    });
    if (!result.ok) {
      throw new ApiError('PAYMENT_DECLINED', 402, { reason: result.declineReason });
    }
    await post(adjustmentCapturePlan(booking.id, adjustment.extraAmountF, adjustment.id));
  }

  const feePct = await snapshotFeePct(booking);
  const extraCleanerF = Math.round(adjustment.extraHours * booking.cleanerRateF);
  const extraFeeF = Math.round((extraCleanerF * feePct) / 100);
  const newEstHours = booking.estHours + adjustment.extraHours;

  const [updatedBooking, approved] = await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        estHours: newEstHours,
        slotMinutes: Math.ceil(newEstHours * 60),
        cleanerAmountF: { increment: extraCleanerF },
        serviceFeeF: { increment: extraFeeF },
        totalF: { increment: adjustment.extraAmountF },
      },
    }),
    prisma.priceAdjustment.update({
      where: { id: adjustment.id },
      data: { status: 'approved', approvedAt: new Date() },
    }),
  ]);

  return ok({ booking: updatedBooking, adjustment: approved });
});
