import { ok, handler, ApiError } from '@/lib/server/http';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

/** POST /api/offers/:id/decline — cleaner passes; other offers stay live. */
export const POST = handler(async (_request: Request, { params }: Ctx) => {
  const user = await requireDbUser(await requireSession());
  const profile = await prisma.cleanerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new ApiError('OFFER_NOT_FOUND', 404);

  const { count } = await prisma.bookingOffer.updateMany({
    where: { id: params.id, cleanerId: profile.id, status: { in: ['offered', 'seen'] } },
    data: { status: 'declined' },
  });
  if (count === 0) throw new ApiError('OFFER_NOT_FOUND', 404);
  return ok({ declined: true });
});
