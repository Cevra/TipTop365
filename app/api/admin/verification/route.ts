import { z } from 'zod';
import { ok, handler } from '@/lib/server/http';
import { parseQuery } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';
// Session cookie read → never statically prerenderable.
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status: z.enum(['applied', 'interview_scheduled', 'checklist', 'approved', 'rejected']).optional(),
});

/** GET /api/admin/verification?status= — the applicant queue (E9.3, §8 admin). */
export const GET = handler(async (request: Request) => {
  await requireRole('admin');
  const { status } = parseQuery(request.url, querySchema);
  const applications = await prisma.verificationApplication.findMany({
    where: status ? { status } : { status: { in: ['applied', 'interview_scheduled', 'checklist'] } },
    orderBy: { createdAt: 'asc' },
    include: {
      cleaner: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          cleanerProfile: { select: { tier: true, cityId: true, hourlyRateF: true } },
          cleanerLegalProfile: { select: { legalRegime: true, isStudent: true } },
        },
      },
    },
  });
  return ok({ applications });
});
