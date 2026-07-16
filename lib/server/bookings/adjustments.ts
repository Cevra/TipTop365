import 'server-only';
import { prisma } from '@/lib/server/db';
import { ApiError } from '@/lib/server/http';
import { parsePricingConfig } from '@/lib/domain/pricing';

/** Fee % from the booking's SNAPSHOTTED config version — never the live one (E4.7). */
export async function snapshotFeePct(booking: {
  propertyId: string;
  pricingConfigVersion: number;
}): Promise<number> {
  const property = await prisma.property.findUniqueOrThrow({ where: { id: booking.propertyId } });
  if (!property.cityId) throw new ApiError('PROPERTY_CITY_REQUIRED', 409);
  const configRow = await prisma.pricingConfig.findUnique({
    where: { cityId_version: { cityId: property.cityId, version: booking.pricingConfigVersion } },
  });
  if (!configRow) throw new ApiError('PRICING_CONFIG_NOT_FOUND', 500);
  return parsePricingConfig(configRow).platformFeePct;
}
