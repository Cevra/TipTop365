import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { resolveCitySlug } from '@/lib/server/backfill/mapIdentity';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/cities — all cities incl. inactive (E9.6). */
export const GET = handler(async () => {
  await requireRole('admin');
  const cities = await prisma.city.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { cleanerProfiles: true, properties: true } } },
  });
  return ok({ cities });
});

const createSchema = z.object({
  name: z.string().min(2).max(60),
  launchStage: z.string().max(30).optional(),
});

/** POST /api/admin/cities — add a launch city (slug derived, §1 multi-city). */
export const POST = handler(async (request: Request) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const body = await parseBody(request, createSchema);

  const slug = resolveCitySlug(body.name);
  const existing = await prisma.city.findFirst({ where: { OR: [{ slug }, { name: body.name }] } });
  if (existing) throw new ApiError('CITY_EXISTS', 409, { slug });

  const city = await prisma.city.create({
    data: { name: body.name, slug, launchStage: body.launchStage },
  });
  await audit({
    actorUserId: admin.id,
    action: 'city.created',
    entityType: 'city',
    entityId: city.id,
    after: { name: city.name, slug },
    ip: clientIp(request),
  });
  return ok({ city }, { status: 201 });
});

const patchSchema = z.object({ id: z.string().min(1), active: z.boolean() });

/** PATCH /api/admin/cities — toggle active (audited). */
export const PATCH = handler(async (request: Request) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const body = await parseBody(request, patchSchema);

  const city = await prisma.city.findUnique({ where: { id: body.id } });
  if (!city) throw new ApiError('CITY_NOT_FOUND', 404);
  const updated = await prisma.city.update({ where: { id: city.id }, data: { active: body.active } });
  await audit({
    actorUserId: admin.id,
    action: body.active ? 'city.activated' : 'city.deactivated',
    entityType: 'city',
    entityId: city.id,
    ip: clientIp(request),
  });
  return ok({ city: updated });
});
