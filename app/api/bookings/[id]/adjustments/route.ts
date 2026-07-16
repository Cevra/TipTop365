import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { snapshotFeePct } from '@/lib/server/bookings/adjustments';

export const runtime = 'nodejs';

const bodySchema = z.object({
  extraHours: z
    .number()
    .positive()
    .max(8)
    .refine((h) => Number.isInteger(h * 4), 'extraHours must be in quarter-hour steps'),
  reason: z.string().min(3).max(300),
});

type Ctx = { params: { id: string } };

/**
 * POST /api/bookings/:id/adjustments (E4.7, §5) — the assigned cleaner
 * requests extra time when the real scope exceeds the declaration. Allowed
 * only in accepted/in_progress; one open request per booking; the customer
 * must approve BEFORE the extra work happens.
 */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const user = await requireDbUser(await requireSession());
  const body = await parseBody(request, bodySchema);

  const profile = await prisma.cleanerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new ApiError('NOT_A_CLEANER', 403);

  const booking = await prisma.booking.findFirst({
    where: { id: params.id, cleanerId: profile.id },
  });
  if (!booking) throw new ApiError('BOOKING_NOT_FOUND', 404);
  if (booking.status !== 'accepted' && booking.status !== 'in_progress') {
    throw new ApiError('ILLEGAL_TRANSITION', 409, { from: booking.status, action: 'adjustment' });
  }
  const pending = await prisma.priceAdjustment.count({
    where: { bookingId: booking.id, status: 'requested' },
  });
  if (pending > 0) throw new ApiError('ADJUSTMENT_PENDING', 409);

  // Delta priced from the booking's own rate + snapshotted fee (§6 math).
  const feePct = await snapshotFeePct(booking);
  const extraCleanerF = Math.round(body.extraHours * booking.cleanerRateF);
  const extraFeeF = Math.round((extraCleanerF * feePct) / 100);

  const adjustment = await prisma.priceAdjustment.create({
    data: {
      bookingId: booking.id,
      requestedById: profile.id,
      reason: body.reason,
      extraHours: body.extraHours,
      extraAmountF: extraCleanerF + extraFeeF,
    },
  });

  return ok({ adjustment }, { status: 201 });
});
