import { z } from 'zod';
import { ok, fail, handler, ApiError } from '@/lib/server/http';
import { parseQuery } from '@/lib/server/validation';
import { prisma } from '@/lib/server/db';
import { isEnabled } from '@/lib/server/featureFlags';
import { rateLimit, RATE_LIMITS } from '@/lib/server/rateLimit';
import { clientIp } from '@/lib/server/requestIp';
import {
  cleanerDistanceKm,
  rankCleaners,
  withinServiceRadius,
  type Origin,
} from '@/lib/domain/cleanerRanking';

export const runtime = 'nodejs';

const querySchema = z.object({
  city: z.string().min(1),
  serviceType: z.string().min(1),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

/**
 * GET /api/cleaners/search?city=&serviceType=&lat=&lng= (E3.3, §3 step 5).
 * Public (guests browse, §2). Ranked verified → rating → distance → price;
 * Airbnb service types and the ALLOW_UNVERIFIED_BOOKINGS=false flag both
 * restrict to verified. Response carries `broadcastAvailable` so the wizard
 * can pin the "prvi slobodan" card (H2); the broadcast itself is E3.6.
 * Anti-disintermediation (§12.4): first name + last initial only, no contact.
 */
export const GET = handler(async (request: Request) => {
  const { allowed, retryAfterSec } = rateLimit(`search:${clientIp(request)}`, RATE_LIMITS.search);
  if (!allowed) return fail('RATE_LIMITED', 429, { retryAfterSec });

  const query = parseQuery(request.url, querySchema);

  const city = await prisma.city.findUnique({ where: { slug: query.city } });
  if (!city || !city.active) throw new ApiError('CITY_NOT_FOUND', 404);
  const serviceType = await prisma.serviceType.findUnique({ where: { key: query.serviceType } });
  if (!serviceType || !serviceType.active) throw new ApiError('SERVICE_TYPE_NOT_FOUND', 404);

  const verifiedOnly = serviceType.requiresVerified || !(await isEnabled('ALLOW_UNVERIFIED_BOOKINGS'));

  const candidates = await prisma.cleanerProfile.findMany({
    where: {
      active: true,
      cityId: city.id,
      services: { some: { serviceTypeId: serviceType.id } },
      ...(verifiedOnly ? { tier: 'verified' as const } : {}),
      user: { status: 'active' },
    },
    include: { user: { select: { firstName: true, lastName: true } } },
  });

  const origin: Origin | null =
    query.lat !== undefined && query.lng !== undefined ? { lat: query.lat, lng: query.lng } : null;

  const inRange = candidates.filter((c) => withinServiceRadius(c, origin));
  const ranked = rankCleaners(inRange, origin);

  return ok({
    verifiedOnly,
    broadcastAvailable: ranked.length > 0, // "prvi slobodan" needs at least one candidate
    cleaners: ranked.map((c) => {
      const distance = cleanerDistanceKm(c, origin);
      return {
        id: c.id,
        name: [c.user.firstName, c.user.lastName ? `${c.user.lastName[0]}.` : null]
          .filter(Boolean)
          .join(' '),
        photoUrl: c.photoUrl,
        tier: c.tier,
        idChecked: c.idChecked,
        ratingAvg: c.ratingAvg,
        ratingCount: c.ratingCount,
        hourlyRateF: c.hourlyRateF,
        languages: c.languages,
        distanceKm: distance === null ? null : Math.round(distance * 10) / 10,
      };
    }),
  });
});
