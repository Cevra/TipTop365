import 'server-only';
import { prisma } from '@/lib/server/db';
import { ApiError } from '@/lib/server/http';
import { isEnabled } from '@/lib/server/featureFlags';
import { withinServiceRadius, type Origin } from '@/lib/domain/cleanerRanking';
import { buildQuote, parsePricingConfig } from '@/lib/domain/pricing';
import { applyBookingTransition } from '@/lib/server/bookings/applyTransition';

// Broadcast matching (E3.6, §3 step 5 "first-accept wins" / §5 matching).

/** §5: offers (and the booking's matching window) end 6 h before the slot. */
export const MATCHING_CLOSES_HOURS_BEFORE_SLOT = 6;

/**
 * Create booking_offers for every eligible cleaner (same eligibility rules as
 * /api/cleaners/search: active, city, offers the service, verified when the
 * service or the ALLOW_UNVERIFIED_BOOKINGS flag demands it, radius reaches
 * the property). Idempotent per (booking, cleaner) via the unique pair check.
 */
export async function broadcastOffers(bookingId: string): Promise<{ offered: number }> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { property: true, serviceType: true },
  });
  if (!booking) throw new ApiError('BOOKING_NOT_FOUND', 404);
  if (booking.status !== 'matching') throw new ApiError('NOT_IN_MATCHING', 409);
  if (!booking.property.cityId) throw new ApiError('PROPERTY_CITY_REQUIRED', 409);

  const verifiedOnly =
    booking.serviceType.requiresVerified || !(await isEnabled('ALLOW_UNVERIFIED_BOOKINGS'));

  const candidates = await prisma.cleanerProfile.findMany({
    where: {
      active: true,
      cityId: booking.property.cityId,
      services: { some: { serviceTypeId: booking.serviceTypeId } },
      ...(verifiedOnly ? { tier: 'verified' as const } : {}),
      user: { status: 'active' },
    },
  });

  const origin: Origin | null =
    booking.property.lat !== null && booking.property.lng !== null
      ? { lat: booking.property.lat, lng: booking.property.lng }
      : null;
  const eligible = candidates.filter((c) => withinServiceRadius(c, origin));

  const expiresAt = new Date(
    booking.scheduledAt.getTime() - MATCHING_CLOSES_HOURS_BEFORE_SLOT * 3600_000,
  );

  const existing = await prisma.bookingOffer.findMany({
    where: { bookingId },
    select: { cleanerId: true },
  });
  const alreadyOffered = new Set(existing.map((o) => o.cleanerId));

  const created = await prisma.bookingOffer.createMany({
    data: eligible
      .filter((c) => !alreadyOffered.has(c.id))
      .map((c) => ({ bookingId, cleanerId: c.id, expiresAt })),
  });
  return { offered: created.count };
}

/**
 * First-accept-wins (§3 step 5). Race safety is layered:
 *  1. the FSM applier's status-guarded update on the BOOKING is the real gate
 *     (two accepts → exactly one `matching→accepted` wins, loser 409s), then
 *  2. the winner reprices the booking EXACTLY from the cleaner's rate against
 *     the SNAPSHOTTED config version (never the live config), and
 *  3. sibling offers flip to lost_race, the winner's to accepted.
 * The exact price is ≤ the draft's stored range ceiling by construction
 * (rate ≤ rate_max), so the captured amount never rises — the delta is E5's
 * release/refund business.
 */
export async function acceptOffer(offerId: string, cleanerUserId: string) {
  const offer = await prisma.bookingOffer.findUnique({
    where: { id: offerId },
    include: {
      cleaner: { include: { user: true } },
      booking: { include: { property: { include: { city: true } }, serviceType: true, addons: { include: { addon: true } } } },
    },
  });
  if (!offer || offer.cleaner.user.id !== cleanerUserId) throw new ApiError('OFFER_NOT_FOUND', 404);
  if (offer.status !== 'offered' && offer.status !== 'seen') {
    throw new ApiError('OFFER_NOT_OPEN', 409, { status: offer.status });
  }
  if (offer.expiresAt.getTime() < Date.now()) throw new ApiError('OFFER_EXPIRED', 409);
  if (offer.cleaner.hourlyRateF === null) throw new ApiError('CLEANER_RATE_MISSING', 409);

  // §7 cash model (E5.3): net balance below the city limit blocks NEW jobs
  // until top-up. Checked before the race so a blocked cleaner can't win it.
  const { isCleanerBlocked } = await import('@/lib/server/wallet');
  if (await isCleanerBlocked(offer.cleanerId)) {
    throw new ApiError('CLEANER_BLOCKED_NEGATIVE_BALANCE', 409);
  }

  // The booking-status guard inside the FSM applier decides the race.
  await applyBookingTransition({
    bookingId: offer.bookingId,
    action: 'cleaner_accepted',
    actor: { type: 'cleaner', userId: cleanerUserId },
    meta: { offerId, cleanerProfileId: offer.cleanerId },
  });

  // Winner path: exact reprice against the SNAPSHOTTED config version.
  const repriceData = await buildExactReprice(offer.bookingId, offer.cleanerId, offer.cleaner.hourlyRateF);

  const [booking] = await prisma.$transaction([
    prisma.booking.update({ where: { id: offer.bookingId }, data: repriceData }),
    prisma.bookingOffer.update({ where: { id: offerId }, data: { status: 'accepted' } }),
    prisma.bookingOffer.updateMany({
      where: { bookingId: offer.bookingId, id: { not: offerId }, status: { in: ['offered', 'seen'] } },
      data: { status: 'lost_race' },
    }),
  ]);

  return booking;
}

/**
 * Exact §6 reprice of a booking for a specific cleaner's rate against the
 * booking's SNAPSHOTTED config version. Shared by first-accept (above) and
 * admin reassignment (E9.5) — one reprice implementation, ever.
 */
export async function buildExactReprice(bookingId: string, cleanerProfileId: string, rateF: number) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: {
      property: true,
      serviceType: true,
      addons: { include: { addon: true } },
      recurringPlan: { select: { frequency: true } },
    },
  });
  if (!booking.property.cityId || !booking.property.sizeM2) {
    throw new ApiError('PROPERTY_INCOMPLETE', 409);
  }
  const configRow = await prisma.pricingConfig.findUnique({
    where: {
      cityId_version: { cityId: booking.property.cityId, version: booking.pricingConfigVersion },
    },
  });
  if (!configRow) throw new ApiError('PRICING_CONFIG_NOT_FOUND', 500);
  const cfg = parsePricingConfig(configRow);

  const exact = buildQuote({
    m2: booking.property.sizeM2,
    serviceTypeKey: booking.serviceType.key,
    durationMultiplier: booking.serviceType.durationMultiplier,
    addons: booking.addons.map((a) => ({ key: a.addon.key, hours: a.hoursSnapshot, qty: a.qty })),
    rateF,
    cfg,
    opts: {
      paymentMethod: booking.paymentMethod,
      recurring: booking.recurringPlan?.frequency,
    },
  });

  return {
    cleanerId: cleanerProfileId,
    estHours: exact.estHours,
    cleanerRateF: exact.rateF,
    cleanerAmountF: exact.cleanerAmountF,
    serviceFeeF: exact.serviceFeeF,
    cashFeeF: exact.cashFeeF,
    discountF: exact.discountF,
    totalF: exact.totalF,
    slotMinutes: Math.ceil(exact.estHours * 60),
    pricingSnapshot: JSON.parse(JSON.stringify({ kind: 'exact', ...exact })),
  };
}

/** Expire open offers and time out stuck matchings (§5: slot − 6 h). Cron. */
export async function expireMatching(now = new Date()) {
  const { count: expiredOffers } = await prisma.bookingOffer.updateMany({
    where: { status: { in: ['offered', 'seen'] }, expiresAt: { lt: now } },
    data: { status: 'expired' },
  });

  const cutoff = new Date(now.getTime() + MATCHING_CLOSES_HOURS_BEFORE_SLOT * 3600_000);
  const stuck = await prisma.booking.findMany({
    where: { status: 'matching', scheduledAt: { lt: cutoff } },
    select: { id: true },
  });
  let expiredBookings = 0;
  for (const b of stuck) {
    try {
      await applyBookingTransition({
        bookingId: b.id,
        action: 'offers_expired',
        actor: { type: 'system' },
      });
      expiredBookings++;
    } catch {
      // Raced by a simultaneous accept — the FSM guard already resolved it.
    }
  }
  return { expiredOffers, expiredBookings };
}
