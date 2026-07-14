import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import {
  isForeignKeyViolation,
  propertyUpdateSchema,
  requireOwnedProperty,
  resolveCityId,
} from '@/lib/server/properties';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

/** GET /api/properties/:id — owner-scoped read. */
export const GET = handler(async (_request: Request, { params }: Ctx) => {
  const user = await requireDbUser(await requireSession());
  const property = await requireOwnedProperty(params.id, user.id);
  return ok({ property });
});

/** PATCH /api/properties/:id — partial update, owner-scoped. */
export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const user = await requireDbUser(await requireSession());
  await requireOwnedProperty(params.id, user.id);
  const input = await parseBody(request, propertyUpdateSchema);
  const cityId = await resolveCityId(input.citySlug);
  const { citySlug: _citySlug, ...fields } = input;
  const property = await prisma.property.update({
    where: { id: params.id },
    data: { ...fields, ...(cityId !== undefined ? { cityId } : {}) },
    include: { city: { select: { slug: true, name: true } } },
  });
  return ok({ property });
});

/** DELETE /api/properties/:id — hard delete; 409 if bookings reference it. */
export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const user = await requireDbUser(await requireSession());
  await requireOwnedProperty(params.id, user.id);
  const bookings = await prisma.booking.count({ where: { propertyId: params.id } });
  if (bookings > 0) throw new ApiError('PROPERTY_IN_USE', 409);
  try {
    await prisma.property.delete({ where: { id: params.id } });
  } catch (err) {
    // Race backstop: a booking created between the count and the delete.
    if (isForeignKeyViolation(err)) throw new ApiError('PROPERTY_IN_USE', 409);
    throw err;
  }
  return ok({ deleted: true });
});
