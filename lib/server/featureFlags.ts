import 'server-only';
import { prisma } from '@/lib/server/db';
import {
  flagEnvVar,
  resolveFlag,
  type FeatureFlagKey,
} from '@/lib/shared/featureFlags';

/**
 * Read a feature flag with precedence env override > DB > default (plan D12).
 * DB read is best-effort: if the DB is unreachable, we fall back to env/default
 * rather than throwing — a flag lookup must never take down a request.
 */
export async function isEnabled(key: FeatureFlagKey): Promise<boolean> {
  let dbValue: boolean | null | undefined;
  try {
    const row = await prisma.featureFlag.findUnique({ where: { key } });
    dbValue = row?.enabled ?? null;
  } catch {
    dbValue = undefined;
  }
  return resolveFlag(key, { envValue: process.env[flagEnvVar(key)], dbValue });
}

/** Upsert a flag's DB value (admin action; audited by the caller in E9). */
export async function setFlag(key: FeatureFlagKey, enabled: boolean): Promise<void> {
  await prisma.featureFlag.upsert({
    where: { key },
    create: { key, enabled },
    update: { enabled },
  });
}
