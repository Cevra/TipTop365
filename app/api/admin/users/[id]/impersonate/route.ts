import { ok, handler, ApiError } from '@/lib/server/http';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { adminAuth } from '@/lib/server/firebaseAdmin';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

/**
 * POST /api/admin/users/:id/impersonate (E9.4, §8 "impersonate for support").
 * Mints a short-lived Firebase custom token carrying `impersonatedBy`; the
 * /impersonate client page signs in with it and starts a session whose claims
 * keep the marker — every screen shows the banner and every audit entry can
 * name the real actor. Admins are not impersonatable.
 */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) throw new ApiError('USER_NOT_FOUND', 404);
  if (target.role === 'admin') throw new ApiError('CANNOT_IMPERSONATE_ADMIN', 403);
  if (target.status !== 'active') throw new ApiError('USER_NOT_ACTIVE', 409);

  const token = await adminAuth().createCustomToken(target.firebaseUid, {
    impersonatedBy: session.uid,
  });

  await audit({
    actorUserId: admin.id,
    action: 'user.impersonation_started',
    entityType: 'user',
    entityId: target.id,
    after: { targetUid: target.firebaseUid },
    ip: clientIp(request),
  });

  return ok({ token });
});
