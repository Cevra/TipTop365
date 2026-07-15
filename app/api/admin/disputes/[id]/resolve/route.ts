import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';
import { applyBookingTransition } from '@/lib/server/bookings/applyTransition';
import { getPaymentProvider } from '@/lib/server/payments/mockProvider';

export const runtime = 'nodejs';

const bodySchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('release'), notes: z.string().max(1000).optional() }),
  z.object({ outcome: z.literal('refund'), notes: z.string().max(1000).optional() }),
  z.object({
    outcome: z.literal('partial'),
    partialRefundF: z.number().int().positive(),
    notes: z.string().max(1000).optional(),
  }),
]);

type Ctx = { params: { id: string } };

const OUTCOME_TO_ACTION = {
  release: 'dispute_resolved_release',
  refund: 'dispute_resolved_refund',
  partial: 'dispute_resolved_partial',
} as const;
const OUTCOME_TO_STATUS = {
  release: 'resolved_release',
  refund: 'resolved_refund',
  partial: 'resolved_partial',
} as const;

/**
 * POST /api/admin/disputes/:id/resolve (E5.6, §5/§7/H8) — admin resolves a
 * dispute: release (cleaner paid in full), refund (customer refunded in
 * full), or partial (slider amount back to the customer, remainder split
 * cleaner-first). Ledger postings ride the FSM edge; the PSP refund goes out
 * for the refunded part; everything audited.
 */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const body = await parseBody(request, bodySchema);

  const dispute = await prisma.dispute.findUnique({
    where: { id: params.id },
    include: { booking: true },
  });
  if (!dispute) throw new ApiError('DISPUTE_NOT_FOUND', 404);
  if (dispute.status !== 'open' && dispute.status !== 'investigating') {
    throw new ApiError('DISPUTE_ALREADY_RESOLVED', 409, { status: dispute.status });
  }
  const booking = dispute.booking;

  const refundF =
    body.outcome === 'refund'
      ? booking.totalF
      : body.outcome === 'partial'
        ? body.partialRefundF
        : 0;
  if (body.outcome === 'partial' && refundF >= booking.totalF) {
    throw new ApiError('PARTIAL_REFUND_TOO_LARGE', 400, { max: booking.totalF - 1 });
  }

  const { booking: resolved } = await applyBookingTransition({
    bookingId: booking.id,
    action: OUTCOME_TO_ACTION[body.outcome],
    actor: { type: 'admin', userId: admin.id },
    meta: { disputeId: dispute.id, outcome: body.outcome, refundF },
    effectCtx: { refundF, refundRef: `dispute:${dispute.id}` },
  });

  const updatedDispute = await prisma.dispute.update({
    where: { id: dispute.id },
    data: {
      status: OUTCOME_TO_STATUS[body.outcome],
      resolutionAmountF: refundF || null,
      resolvedById: admin.id,
      notes: body.notes,
    },
  });

  // PSP refund for the refunded part (card bookings only; mock now, Monri E6).
  let refundPayment = null;
  if (refundF > 0 && booking.paymentMethod === 'card') {
    const capture = await prisma.payment.findFirst({
      where: { bookingId: booking.id, kind: 'capture', status: 'succeeded' },
      orderBy: { createdAt: 'desc' },
    });
    if (capture) {
      const provider = getPaymentProvider();
      const result = await provider.refund({
        idempotencyKey: `refund:dispute:${dispute.id}`,
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

  await audit({
    actorUserId: admin.id,
    action: `dispute.resolve.${body.outcome}`,
    entityType: 'dispute',
    entityId: dispute.id,
    before: { status: dispute.status },
    after: { status: updatedDispute.status, refundF, notes: body.notes ?? null },
    ip: clientIp(request),
  });

  return ok({ dispute: updatedDispute, booking: resolved, refund: refundPayment });
});
