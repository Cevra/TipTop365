import { ok, handler, ApiError } from '@/lib/server/http';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

/**
 * POST /api/admin/pricing/:id/publish — atomically make this version the ONLY
 * active one for its city (the "exactly one active per city" invariant E1.2
 * deferred to this task). Existing bookings keep their snapshotted version —
 * publishing never reprices history (§6/G2).
 */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);

  const target = await prisma.pricingConfig.findUnique({
    where: { id: params.id },
    include: { city: { select: { slug: true } } },
  });
  if (!target) throw new ApiError('CONFIG_NOT_FOUND', 404);
  if (target.active) return ok({ published: target }); // idempotent

  const [, published] = await prisma.$transaction([
    prisma.pricingConfig.updateMany({
      where: { cityId: target.cityId, active: true },
      data: { active: false },
    }),
    prisma.pricingConfig.update({ where: { id: target.id }, data: { active: true } }),
  ]);

  await audit({
    actorUserId: admin.id,
    action: 'pricing.published',
    entityType: 'pricing_config',
    entityId: target.id,
    after: { citySlug: target.city.slug, version: target.version },
    ip: clientIp(request),
  });

  return ok({ published });
});
