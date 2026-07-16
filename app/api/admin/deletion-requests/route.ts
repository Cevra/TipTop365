import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { anonymizeUser } from '@/lib/server/anonymize';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/deletion-requests — open queue, oldest first (§8.5). */
export const GET = handler(async () => {
  await requireRole('admin');
  const requests = await prisma.deletionRequest.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, email: true, role: true } } },
  });
  return ok({ requests });
});

const processSchema = z.object({ id: z.string().min(1) });

/**
 * POST /api/admin/deletion-requests — process one: anonymize the person,
 * keep the pseudonymized statutory records, complete the request. Audited
 * with the scrub counts (the audit row itself references only ids).
 */
export const POST = handler(async (request: Request) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const { id } = await parseBody(request, processSchema);

  const deletionRequest = await prisma.deletionRequest.findUnique({ where: { id } });
  if (!deletionRequest) throw new ApiError('REQUEST_NOT_FOUND', 404);
  if (deletionRequest.status !== 'open') return ok({ request: deletionRequest }); // idempotent

  const result = await anonymizeUser(deletionRequest.userId);

  const completed = await prisma.deletionRequest.update({
    where: { id },
    data: { status: 'completed', completedAt: new Date() },
  });

  await audit({
    actorUserId: admin.id,
    action: 'account.deletion_processed',
    entityType: 'deletion_request',
    entityId: id,
    after: {
      userId: result.userId,
      scrubbedProperties: result.scrubbedProperties,
      maskedMessages: result.maskedMessages,
      queuedPhotos: result.queuedPhotos,
      firebaseDeleted: result.firebaseDeleted,
    },
    ip: clientIp(request),
  });

  return ok({ request: completed, result });
});
