import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/promos — codes with redemption counts (E9.6/§8). */
export const GET = handler(async () => {
  await requireRole('admin');
  const promos = await prisma.promoCode.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { redemptions: true } } },
  });
  return ok({ promos });
});

const createSchema = z.object({
  code: z.string().min(3).max(30).regex(/^[A-Z0-9-]+$/, 'uppercase letters, digits, dashes'),
  type: z.enum(['pct', 'fixed']),
  // pct → percentage points (1–100); fixed → integer fenings.
  value: z.number().int().positive(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  maxPerUser: z.number().int().positive().optional(),
});

/** POST /api/admin/promos — create a code (redemption logic = E11.4). */
export const POST = handler(async (request: Request) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const body = await parseBody(request, createSchema);
  if (body.type === 'pct' && body.value > 100) {
    throw new ApiError('VALIDATION_ERROR', 400, { reason: 'pct value must be ≤ 100' });
  }

  const existing = await prisma.promoCode.findUnique({ where: { code: body.code } });
  if (existing) throw new ApiError('PROMO_EXISTS', 409);

  const promo = await prisma.promoCode.create({ data: body });
  await audit({
    actorUserId: admin.id,
    action: 'promo.created',
    entityType: 'promo_code',
    entityId: promo.id,
    after: { code: promo.code, type: promo.type, value: promo.value },
    ip: clientIp(request),
  });
  return ok({ promo }, { status: 201 });
});

const patchSchema = z.object({ id: z.string().min(1), active: z.boolean() });

/** PATCH /api/admin/promos — activate/deactivate (audited). */
export const PATCH = handler(async (request: Request) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const body = await parseBody(request, patchSchema);

  const promo = await prisma.promoCode.findUnique({ where: { id: body.id } });
  if (!promo) throw new ApiError('PROMO_NOT_FOUND', 404);
  const updated = await prisma.promoCode.update({
    where: { id: promo.id },
    data: { active: body.active },
  });
  await audit({
    actorUserId: admin.id,
    action: body.active ? 'promo.activated' : 'promo.deactivated',
    entityType: 'promo_code',
    entityId: promo.id,
    ip: clientIp(request),
  });
  return ok({ promo: updated });
});
