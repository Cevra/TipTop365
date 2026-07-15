import { ok, handler } from '@/lib/server/http';
import { requireRole } from '@/lib/server/auth/session';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';
// Session cookie read → never statically prerenderable.
export const dynamic = 'force-dynamic';

/** GET /api/admin/disputes — open/investigating queue (E8.2 builds the UI). */
export const GET = handler(async () => {
  await requireRole('admin');
  const disputes = await prisma.dispute.findMany({
    where: { status: { in: ['open', 'investigating'] } },
    orderBy: { createdAt: 'asc' },
    include: {
      booking: {
        select: { code: true, totalF: true, paymentMethod: true, status: true, scheduledAt: true },
      },
      openedBy: { select: { email: true } },
    },
  });
  return ok({ disputes });
});
