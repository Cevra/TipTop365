import { ok, handler, ApiError } from '@/lib/server/http';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { applyBookingTransition } from '@/lib/server/bookings/applyTransition';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

/**
 * POST /api/bookings/:id/confirm-completion (§10) — the customer approves the
 * finished job → completed → LEDGER RELEASE (E5.2). The booking-detail UI
 * button lands with E3.9 (H4); the endpoint is the stable contract.
 */
export const POST = handler(async (_request: Request, { params }: Ctx) => {
  const user = await requireDbUser(await requireSession());
  const booking = await prisma.booking.findFirst({
    where: { id: params.id, customerId: user.id },
  });
  if (!booking) throw new ApiError('BOOKING_NOT_FOUND', 404);

  const { booking: completed } = await applyBookingTransition({
    bookingId: booking.id,
    action: 'completion_confirmed',
    actor: { type: 'customer', userId: user.id },
  });
  return ok({ booking: completed });
});
