import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';

const bodySchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().min(1).max(300).optional(),
});

type Ctx = { params: { id: string } };

/**
 * POST /api/admin/users/:id/status — suspend / reactivate (E9.4, audited).
 * Suspension bites at requireDbUser: every authenticated API call by a
 * suspended user fails 403 USER_SUSPENDED regardless of their Firebase state.
 * Admins cannot suspend themselves or other admins (privilege containment).
 */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const { status, reason } = await parseBody(request, bodySchema);

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) throw new ApiError('USER_NOT_FOUND', 404);
  if (target.role === 'admin') throw new ApiError('CANNOT_MODIFY_ADMIN', 403);
  if (target.status === status) return ok({ user: target }); // idempotent

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: { status },
  });

  await audit({
    actorUserId: admin.id,
    action: status === 'suspended' ? 'user.suspended' : 'user.reactivated',
    entityType: 'user',
    entityId: target.id,
    before: { status: target.status },
    after: { status, reason },
    ip: clientIp(request),
  });

  return ok({ user: updated });
});
