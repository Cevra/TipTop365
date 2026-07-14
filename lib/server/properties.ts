import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/server/db';
import { ApiError } from '@/lib/server/http';

// Property CRUD internals (E3.1). All access is owner-scoped: every query
// filters by ownerId from the verified session — a foreign id 404s (not 403,
// no existence oracle).

export const checklistSchema = z.object({
  linens: z.boolean().default(false),
  restock: z.array(z.string().min(1).max(40)).max(20).default([]),
  damageReport: z.boolean().default(false),
});

export const propertyCreateSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  type: z.enum(['apartment', 'house', 'office', 'vacation_rental']).default('apartment'),
  citySlug: z.string().min(1).optional(),
  street: z.string().min(1).max(120).optional(),
  houseNo: z.string().min(1).max(20).optional(),
  floor: z.string().max(20).optional(),
  hasElevator: z.boolean().default(false),
  sizeM2: z.number().int().min(1).max(2000).optional(),
  rooms: z.number().int().min(1).max(50).optional(),
  bathrooms: z.number().int().min(1).max(20).optional(),
  pets: z.boolean().default(false),
  accessNotes: z.string().max(500).optional(),
  checklist: checklistSchema.optional(),
  isAirbnb: z.boolean().default(false),
});

export const propertyUpdateSchema = propertyCreateSchema.partial();

export async function resolveCityId(citySlug: string | undefined): Promise<string | undefined> {
  if (!citySlug) return undefined;
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city || !city.active) throw new ApiError('CITY_NOT_FOUND', 404);
  return city.id;
}

export async function requireOwnedProperty(id: string, ownerId: string) {
  const property = await prisma.property.findFirst({ where: { id, ownerId } });
  if (!property) throw new ApiError('PROPERTY_NOT_FOUND', 404);
  return property;
}

/**
 * FK-violation detection across Prisma's error taxonomy: P2003 (known) plus
 * raw Postgres 23001 (restrict) / 23503 (foreign key), which Prisma 6 surfaces
 * as PrismaClientUnknownRequestError for ON DELETE RESTRICT relations.
 */
export function isForeignKeyViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  if ((err as { code?: string }).code === 'P2003') return true;
  const message = (err as { message?: string }).message ?? '';
  return message.includes('23001') || message.includes('23503');
}

export function toCreateData(
  input: z.infer<typeof propertyCreateSchema>,
  ownerId: string,
  cityId: string | undefined,
): Prisma.PropertyUncheckedCreateInput {
  const { citySlug: _citySlug, ...fields } = input;
  return { ...fields, ownerId, cityId };
}
