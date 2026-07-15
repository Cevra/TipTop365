import { ok, handler } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import {
  propertyCreateSchema,
  resolveCityId,
  toCreateData,
} from '@/lib/server/properties';

export const runtime = 'nodejs';
// Session cookie read → never statically prerenderable.
export const dynamic = 'force-dynamic';

/** GET /api/properties — the caller's saved properties, newest first. */
export const GET = handler(async () => {
  const user = await requireDbUser(await requireSession());
  const properties = await prisma.property.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { city: { select: { slug: true, name: true } } },
  });
  return ok({ properties });
});

/** POST /api/properties — create a property (host checklists included, §3). */
export const POST = handler(async (request: Request) => {
  const user = await requireDbUser(await requireSession());
  const input = await parseBody(request, propertyCreateSchema);
  const cityId = await resolveCityId(input.citySlug);
  const property = await prisma.property.create({
    data: toCreateData(input, user.id, cityId),
    include: { city: { select: { slug: true, name: true } } },
  });
  return ok({ property }, { status: 201 });
});
