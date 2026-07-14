import { z } from 'zod';
import { ok, handler } from '@/lib/server/http';
import { parseQuery } from '@/lib/server/validation';
import { prisma } from '@/lib/server/db';
import { ApiError } from '@/lib/server/http';
import { loadActiveConfig } from '@/lib/server/pricing';

export const runtime = 'nodejs';

const querySchema = z.object({ city: z.string().min(1).default('sarajevo') });

/**
 * GET /api/catalog?city=<slug> (plan §10) — public subset of the catalog the
 * wizard and profile forms need: active services + addons (bilingual names)
 * and the city config's public pricing parameters. No secrets, no auth.
 */
export const GET = handler(async (request: Request) => {
  const { city: citySlug } = parseQuery(request.url, querySchema);

  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city || !city.active) throw new ApiError('CITY_NOT_FOUND', 404);

  const [services, addons, cfg] = await Promise.all([
    prisma.serviceType.findMany({
      where: { active: true },
      select: {
        key: true,
        nameBs: true,
        nameEn: true,
        durationMultiplier: true,
        requiresVerified: true,
      },
    }),
    prisma.addon.findMany({
      where: { active: true },
      select: { key: true, nameBs: true, nameEn: true, hours: true, unit: true },
    }),
    loadActiveConfig(city.id),
  ]);

  return ok({
    city: { slug: city.slug, name: city.name },
    services,
    addons,
    pricing: {
      rateMinF: cfg.rateMinF,
      rateMaxF: cfg.rateMaxF,
      platformFeePct: cfg.platformFeePct,
      recurringDiscountPct: cfg.recurringDiscountPct,
      cashFeeF: cfg.cashFeeF,
      version: cfg.version,
    },
  });
});
