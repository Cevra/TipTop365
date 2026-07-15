import { ok, handler } from '@/lib/server/http';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';
// Session cookie read → never statically prerenderable.
export const dynamic = 'force-dynamic';

/**
 * GET /api/offers — the calling cleaner's open offers (offers inbox, E4.2 UI).
 * Address privacy (H5): area only — street/houseNo withheld until accept.
 */
export const GET = handler(async () => {
  const user = await requireDbUser(await requireSession());
  const profile = await prisma.cleanerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return ok({ offers: [] });

  const offers = await prisma.bookingOffer.findMany({
    where: { cleanerId: profile.id, status: { in: ['offered', 'seen'] }, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'asc' },
    include: {
      booking: {
        select: {
          code: true,
          scheduledAt: true,
          slotMinutes: true,
          estHours: true,
          paymentMethod: true,
          serviceType: { select: { key: true, nameBs: true, nameEn: true } },
          property: { select: { sizeM2: true, rooms: true, pets: true, floor: true, city: { select: { name: true } } } },
        },
      },
    },
  });
  return ok({ offers });
});
