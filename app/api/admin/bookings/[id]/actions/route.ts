import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { applyBookingTransition } from '@/lib/server/bookings/applyTransition';
import { buildExactReprice } from '@/lib/server/bookings/broadcast';
import { getPaymentProvider } from '@/lib/server/payments/mockProvider';
import { manualRefundPlan } from '@/lib/domain/ledger/postings';
import { post } from '@/lib/server/ledger/engine';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('no_show'), reason: z.string().min(1).max(300) }),
  z.object({ action: z.literal('reassign'), cleanerProfileId: z.string().min(1) }),
  z.object({
    action: z.literal('refund'),
    amountF: z.number().int().positive(),
    reason: z.string().min(1).max(300),
  }),
]);

type Ctx = { params: { id: string } };

// Post-settlement statuses: escrow is drained, manual refunds reverse revenue.
const SETTLED = ['completed', 'refunded', 'cancelled', 'expired'] as const;

/**
 * POST /api/admin/bookings/:id/actions (E9.5) — the three §8 back-office
 * interventions, every one audited:
 *  - no_show: the §5 admin edge (accepted/on_my_way → cancelled, full refund
 *    via the FSM's ledger.refund effect);
 *  - reassign: swap the cleaner on an accepted booking, exact §6 reprice via
 *    the SAME code path first-accept uses;
 *  - refund: manual/goodwill refund — PSP refund + payments row + ledger
 *    posting whose source (escrow vs revenue) follows the booking's stage.
 */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const body = await parseBody(request, bodySchema);

  const booking = await prisma.booking.findUnique({ where: { id: params.id } });
  if (!booking) throw new ApiError('BOOKING_NOT_FOUND', 404);

  if (body.action === 'no_show') {
    const { booking: cancelled } = await applyBookingTransition({
      bookingId: booking.id,
      action: 'no_show_reported',
      actor: { type: 'admin', userId: admin.id },
      reason: body.reason,
      effectCtx: { refundF: booking.totalF, refundRef: `noshow:${booking.id}` },
    });
    await audit({
      actorUserId: admin.id,
      action: 'booking.no_show_reported',
      entityType: 'booking',
      entityId: booking.id,
      after: { reason: body.reason },
      ip: clientIp(request),
    });
    return ok({ booking: cancelled });
  }

  if (body.action === 'reassign') {
    if (booking.status !== 'accepted') {
      throw new ApiError('ILLEGAL_TRANSITION', 409, { from: booking.status, action: 'reassign' });
    }
    const cleaner = await prisma.cleanerProfile.findUnique({
      where: { id: body.cleanerProfileId },
      include: { user: { select: { status: true } } },
    });
    if (!cleaner || !cleaner.active || cleaner.user.status !== 'active') {
      throw new ApiError('CLEANER_NOT_AVAILABLE', 409);
    }
    if (cleaner.hourlyRateF === null) throw new ApiError('CLEANER_RATE_MISSING', 409);

    const reprice = await buildExactReprice(booking.id, cleaner.id, cleaner.hourlyRateF);
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: reprice });

    await audit({
      actorUserId: admin.id,
      action: 'booking.reassigned',
      entityType: 'booking',
      entityId: booking.id,
      before: { cleanerId: booking.cleanerId, totalF: booking.totalF },
      after: { cleanerId: cleaner.id, totalF: updated.totalF },
      ip: clientIp(request),
    });
    return ok({ booking: updated });
  }

  // Manual refund.
  if (body.amountF > booking.totalF) {
    throw new ApiError('REFUND_EXCEEDS_TOTAL', 400, { totalF: booking.totalF });
  }
  const capture = await prisma.payment.findFirst({
    where: { bookingId: booking.id, kind: 'capture', status: 'succeeded' },
    orderBy: { createdAt: 'desc' },
  });
  if (!capture) throw new ApiError('NOTHING_CAPTURED', 409);

  const refundCount = await prisma.payment.count({
    where: { bookingId: booking.id, kind: 'refund' },
  });
  const ref = `${booking.id}:${refundCount + 1}`;

  const provider = getPaymentProvider();
  const result = await provider.refund({
    idempotencyKey: `refund:manual:${ref}`,
    providerRef: capture.providerRef ?? '',
    amountF: body.amountF,
  });
  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      provider: provider.name,
      providerRef: result.providerRef,
      kind: 'refund',
      status: result.status,
      amountF: body.amountF,
    },
  });

  const source = (SETTLED as readonly string[]).includes(booking.status) ? 'revenue' : 'escrow';
  await post(manualRefundPlan(booking.id, body.amountF, source, ref));

  await audit({
    actorUserId: admin.id,
    action: 'booking.manual_refund',
    entityType: 'booking',
    entityId: booking.id,
    after: { amountF: body.amountF, reason: body.reason, source },
    ip: clientIp(request),
  });

  return ok({ payment, source });
});
