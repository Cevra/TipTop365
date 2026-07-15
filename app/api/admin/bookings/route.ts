import { z } from 'zod';
import { ok, handler } from '@/lib/server/http';
import { parseQuery } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z
    .enum(['draft', 'pending_payment', 'matching', 'accepted', 'on_my_way', 'in_progress', 'pending_completion', 'completed', 'disputed', 'refunded', 'cancelled', 'expired'])
    .optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const PAGE_SIZE = 50;

/** GET /api/admin/bookings?status=&q=&page= — back-office list (E9.5). */
export const GET = handler(async (request: Request) => {
  await requireRole('admin');
  const { status, q, page } = parseQuery(request.url, querySchema);

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' as const } },
            { customer: { email: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        code: true,
        status: true,
        scheduledAt: true,
        totalF: true,
        paymentMethod: true,
        matchingMode: true,
        customer: { select: { email: true, firstName: true, lastName: true } },
        cleaner: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        serviceType: { select: { key: true, nameBs: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  return ok({ bookings, total, page, pageSize: PAGE_SIZE });
});
