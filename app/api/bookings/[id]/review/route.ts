import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';

const bodySchema = z.object({
  stars: z.number().int().min(1).max(5),
  tags: z.array(z.string().min(1).max(30)).max(10).default([]),
  body: z.string().max(1000).optional(),
});

type Ctx = { params: { id: string } };

/**
 * POST /api/bookings/:id/review (§3 step "mutual ratings", E4.8) — either
 * party reviews a COMPLETED booking, once, in their direction. Double-blind:
 * reviews stay hidden until both directions exist, then both reveal and the
 * customer→cleaner stars fold into the cleaner's aggregate. (The reveal
 * window fallback — publish after N days even if one side never reviews —
 * is E8.1's refinement, as is the review UI.)
 */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const user = await requireDbUser(await requireSession());
  const input = await parseBody(request, bodySchema);

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: { cleaner: { select: { id: true, userId: true } } },
  });
  if (!booking) throw new ApiError('BOOKING_NOT_FOUND', 404);

  const isCustomer = booking.customerId === user.id;
  const isCleaner = booking.cleaner?.userId === user.id;
  if (!isCustomer && !isCleaner) throw new ApiError('BOOKING_NOT_FOUND', 404);
  if (booking.status !== 'completed') {
    throw new ApiError('BOOKING_NOT_COMPLETED', 409, { status: booking.status });
  }

  const direction = isCustomer ? 'customer_to_cleaner' : 'cleaner_to_customer';
  try {
    await prisma.review.create({
      data: {
        bookingId: booking.id,
        direction,
        stars: input.stars,
        tags: input.tags,
        body: input.body,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new ApiError('ALREADY_REVIEWED', 409);
    }
    throw err;
  }

  // Double-blind reveal: both directions in → both become visible and the
  // cleaner aggregate updates from ALL visible customer reviews.
  const reviews = await prisma.review.findMany({ where: { bookingId: booking.id } });
  let revealed = false;
  if (reviews.length === 2 && booking.cleaner) {
    await prisma.review.updateMany({ where: { bookingId: booking.id }, data: { visible: true } });
    revealed = true;

    const agg = await prisma.review.aggregate({
      where: {
        direction: 'customer_to_cleaner',
        visible: true,
        booking: { cleanerId: booking.cleaner.id },
      },
      _avg: { stars: true },
      _count: true,
    });
    await prisma.cleanerProfile.update({
      where: { id: booking.cleaner.id },
      data: {
        ratingAvg: agg._avg.stars === null ? null : Math.round(agg._avg.stars * 100) / 100,
        ratingCount: agg._count,
      },
    });
  }

  return ok({ direction, revealed });
});
