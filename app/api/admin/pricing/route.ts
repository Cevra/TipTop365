import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody, parseQuery } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { parsePricingConfig, PricingConfigError } from '@/lib/domain/pricing';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const listQuery = z.object({ city: z.string().min(1) });

/** GET /api/admin/pricing?city= — all versions for a city, newest first. */
export const GET = handler(async (request: Request) => {
  await requireRole('admin');
  const { city: slug } = parseQuery(request.url, listQuery);
  const city = await prisma.city.findUnique({ where: { slug } });
  if (!city) throw new ApiError('CITY_NOT_FOUND', 404);
  const versions = await prisma.pricingConfig.findMany({
    where: { cityId: city.id },
    orderBy: { version: 'desc' },
  });
  return ok({ city: { slug: city.slug, name: city.name }, versions });
});

const draftSchema = z.object({
  citySlug: z.string().min(1),
  m2Bands: z.unknown(),
  rateMinF: z.number().int().positive(),
  rateMaxF: z.number().int().positive(),
  platformFeePct: z.number().min(0).max(100),
  recurringDiscountPct: z.unknown(),
  cashFeeF: z.number().int().min(0).nullable(),
  cancellationRules: z.unknown(),
  negativeBalanceLimitF: z.number().int().max(0),
  autoConfirmHours: z.number().int().min(1).max(168),
  minAfterPhotosPerRoom: z.number().int().min(1).max(10),
});

/**
 * POST /api/admin/pricing — create the next DRAFT version for a city (E2.3).
 * The candidate is validated through the SAME parser the quote path uses
 * (parsePricingConfig), so an admin cannot save a config the engine would
 * later reject at quote time. Publishing is a separate, audited step.
 */
export const POST = handler(async (request: Request) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const body = await parseBody(request, draftSchema);

  const city = await prisma.city.findUnique({ where: { slug: body.citySlug } });
  if (!city) throw new ApiError('CITY_NOT_FOUND', 404);

  const last = await prisma.pricingConfig.findFirst({
    where: { cityId: city.id },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;

  // Engine-validate BEFORE persisting — malformed jsonb never reaches the DB.
  try {
    parsePricingConfig({
      version,
      m2Bands: body.m2Bands ?? null,
      recurringDiscountPct: body.recurringDiscountPct ?? null,
      rateMinF: body.rateMinF,
      rateMaxF: body.rateMaxF,
      platformFeePct: body.platformFeePct,
      cashFeeF: body.cashFeeF,
    });
  } catch (err) {
    if (err instanceof PricingConfigError) {
      throw new ApiError('CONFIG_INVALID', 400, { reason: err.message });
    }
    throw err;
  }

  const draft = await prisma.pricingConfig.create({
    data: {
      cityId: city.id,
      version,
      active: false,
      m2Bands: body.m2Bands as object,
      rateMinF: body.rateMinF,
      rateMaxF: body.rateMaxF,
      platformFeePct: body.platformFeePct,
      recurringDiscountPct: body.recurringDiscountPct as object,
      cashFeeF: body.cashFeeF,
      cancellationRules: body.cancellationRules as object,
      negativeBalanceLimitF: body.negativeBalanceLimitF,
      autoConfirmHours: body.autoConfirmHours,
      minAfterPhotosPerRoom: body.minAfterPhotosPerRoom,
    },
  });

  await audit({
    actorUserId: admin.id,
    action: 'pricing.draft_created',
    entityType: 'pricing_config',
    entityId: draft.id,
    after: { citySlug: city.slug, version },
    ip: clientIp(request),
  });

  return ok({ draft }, { status: 201 });
});
