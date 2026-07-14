import 'server-only';
import { prisma } from '@/lib/server/db';
import { ApiError } from '@/lib/server/http';
import {
  buildQuote,
  parsePricingConfig,
  PricingConfigError,
  PricingError,
  type AddonInput,
  type PricingConfigData,
  type PricingSnapshot,
  type RecurringFrequency,
} from '@/lib/domain/pricing';

// Server glue for the pure pricing engine (E2.2): loads the catalog + active
// city config from Postgres and runs buildQuote. The engine itself stays pure.

export interface QuoteRequest {
  citySlug: string;
  serviceTypeKey: string;
  m2: number;
  addons: { key: string; qty: number }[];
  paymentMethod: 'card' | 'cash';
  recurring?: RecurringFrequency;
  /** Chosen cleaner's rate. Absent pre-selection → a min–max range is quoted. */
  rateF?: number;
}

export type QuoteResult =
  | { kind: 'exact'; quote: PricingSnapshot }
  | { kind: 'range'; min: PricingSnapshot; max: PricingSnapshot };

/** Active pricing config = highest active version for the city (E2.3 owns publishing). */
export async function loadActiveConfig(cityId: string): Promise<PricingConfigData> {
  const row = await prisma.pricingConfig.findFirst({
    where: { cityId, active: true },
    orderBy: { version: 'desc' },
  });
  if (!row) throw new ApiError('PRICING_CONFIG_NOT_FOUND', 404);
  try {
    return parsePricingConfig(row);
  } catch (err) {
    if (err instanceof PricingConfigError) {
      // Admin-broken config: surface as a 500 with a stable code, log the cause.
      console.error('Broken pricing config', cityId, err.message);
      throw new ApiError('PRICING_CONFIG_INVALID', 500);
    }
    throw err;
  }
}

export async function computeQuote(req: QuoteRequest): Promise<QuoteResult> {
  const city = await prisma.city.findUnique({ where: { slug: req.citySlug } });
  if (!city || !city.active) throw new ApiError('CITY_NOT_FOUND', 404);

  const serviceType = await prisma.serviceType.findUnique({ where: { key: req.serviceTypeKey } });
  if (!serviceType || !serviceType.active) throw new ApiError('SERVICE_TYPE_NOT_FOUND', 404);

  const cfg = await loadActiveConfig(city.id);

  const addonRows = await prisma.addon.findMany({
    where: { key: { in: req.addons.map((a) => a.key) }, active: true },
  });
  const addonByKey = new Map(addonRows.map((a) => [a.key, a]));
  const addons: AddonInput[] = req.addons.map(({ key, qty }) => {
    const row = addonByKey.get(key);
    if (!row) throw new ApiError('ADDON_NOT_FOUND', 404, { key });
    return { key, hours: row.hours, qty };
  });

  const base = {
    m2: req.m2,
    serviceTypeKey: serviceType.key,
    durationMultiplier: serviceType.durationMultiplier,
    addons,
    cfg,
  };
  const opts = { paymentMethod: req.paymentMethod, recurring: req.recurring };

  try {
    if (req.rateF !== undefined) {
      return { kind: 'exact', quote: buildQuote({ ...base, rateF: req.rateF, opts }) };
    }
    return {
      kind: 'range',
      min: buildQuote({ ...base, rateF: cfg.rateMinF, opts }),
      max: buildQuote({ ...base, rateF: cfg.rateMaxF, opts }),
    };
  } catch (err) {
    if (err instanceof PricingError) throw new ApiError('QUOTE_INVALID', 400, { reason: err.message });
    throw err;
  }
}
