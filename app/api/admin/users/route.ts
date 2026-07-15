import { z } from 'zod';
import { ok, handler } from '@/lib/server/http';
import { parseQuery } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  q: z.string().max(100).optional(),
  role: z.enum(['customer', 'cleaner', 'admin']).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const PAGE_SIZE = 50;

/** GET /api/admin/users?q=&role=&page= — search across email + names (E9.4). */
export const GET = handler(async (request: Request) => {
  await requireRole('admin');
  const { q, role, page } = parseQuery(request.url, querySchema);

  const where = {
    ...(role ? { role } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        firebaseUid: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isHost: true,
        createdAt: true,
        cleanerProfile: { select: { tier: true, active: true, hourlyRateF: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return ok({ users, total, page, pageSize: PAGE_SIZE });
});
