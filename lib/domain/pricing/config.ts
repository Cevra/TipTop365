// Pricing-config parsing (E2.1, plan §6). The Prisma PricingConfig row stores
// admin-edited jsonb — validate it into a typed shape before any math runs.
// Malformed config throws PricingConfigError loudly instead of producing NaN
// totals. Pure module: no I/O, no server-only.

import { z } from 'zod';

export class PricingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingConfigError';
  }
}

const bandSchema = z.object({
  maxM2: z.number().int().positive(),
  hours: z.number().positive(),
});

// Exact shape prisma/seed.ts writes to pricing_configs.m2_bands.
const m2BandsSchema = z.object({
  bands: z.array(bandSchema).min(1),
  extraPer40M2: z.number().positive(),
});

const recurringDiscountSchema = z.object({
  weekly: z.number().min(0).max(100),
  biweekly: z.number().min(0).max(100),
  monthly: z.number().min(0).max(100),
});

export type M2Band = z.infer<typeof bandSchema>;
export type RecurringFrequency = keyof z.infer<typeof recurringDiscountSchema>;

export interface PricingConfigData {
  bands: M2Band[];
  extraPer40M2: number;
  rateMinF: number;
  rateMaxF: number;
  platformFeePct: number;
  recurringDiscountPct: Record<RecurringFrequency, number>;
  cashFeeF: number;
  version: number;
}

/** Row shape as it comes off Prisma (jsonb columns are `unknown` here). */
export interface PricingConfigRow {
  version: number;
  m2Bands: unknown;
  recurringDiscountPct: unknown;
  rateMinF: number;
  rateMaxF: number;
  platformFeePct: number;
  cashFeeF: number | null;
}

export function parsePricingConfig(row: PricingConfigRow): PricingConfigData {
  const bandsResult = m2BandsSchema.safeParse(row.m2Bands);
  if (!bandsResult.success) {
    throw new PricingConfigError(`m2_bands malformed: ${bandsResult.error.message}`);
  }
  const discountResult = recurringDiscountSchema.safeParse(row.recurringDiscountPct);
  if (!discountResult.success) {
    throw new PricingConfigError(
      `recurring_discount_pct malformed: ${discountResult.error.message}`,
    );
  }

  const bands = bandsResult.data.bands;
  for (let i = 1; i < bands.length; i++) {
    if (bands[i].maxM2 <= bands[i - 1].maxM2 || bands[i].hours < bands[i - 1].hours) {
      throw new PricingConfigError(
        `m2_bands must be strictly increasing in maxM2 and non-decreasing in hours (index ${i})`,
      );
    }
  }

  if (
    !Number.isInteger(row.rateMinF) ||
    !Number.isInteger(row.rateMaxF) ||
    row.rateMinF <= 0 ||
    row.rateMaxF < row.rateMinF
  ) {
    throw new PricingConfigError(`rate bounds invalid: [${row.rateMinF}, ${row.rateMaxF}]`);
  }
  if (!(row.platformFeePct >= 0 && row.platformFeePct <= 100)) {
    throw new PricingConfigError(`platform_fee_pct out of range: ${row.platformFeePct}`);
  }
  if (row.cashFeeF !== null && (!Number.isInteger(row.cashFeeF) || row.cashFeeF < 0)) {
    throw new PricingConfigError(`cash_fee_f invalid: ${row.cashFeeF}`);
  }

  return {
    bands,
    extraPer40M2: bandsResult.data.extraPer40M2,
    rateMinF: row.rateMinF,
    rateMaxF: row.rateMaxF,
    platformFeePct: row.platformFeePct,
    recurringDiscountPct: discountResult.data,
    cashFeeF: row.cashFeeF ?? 0,
    version: row.version,
  };
}
