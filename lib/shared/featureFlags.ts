// Known feature flags (plan D12). Adding a flag here is the single place that
// makes it typed everywhere. `default` applies when neither an env override nor
// a DB row exists.
export const FEATURE_FLAGS = {
  ALLOW_UNVERIFIED_BOOKINGS: {
    default: true,
    description: 'Allow booking cleaners who have not passed verification.',
  },
  CASH_PAYMENTS_ENABLED: {
    default: true,
    description: 'Allow cash as a payment method (commission debited to wallet).',
  },
  LIVE_MAP_ENABLED: {
    default: true,
    description: 'Show the live cleaner location map while en route.',
  },
  SMS_ENABLED: {
    default: false,
    description: 'Send SMS notifications (stub until a provider is wired in E10).',
  },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export const FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

/** Env override variable name for a flag, e.g. FLAG_CASH_PAYMENTS_ENABLED. */
export function flagEnvVar(key: FeatureFlagKey): string {
  return `FLAG_${key}`;
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const v = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return undefined; // unrecognized → ignore, fall through
}

/**
 * Pure precedence resolver: env override > DB value > coded default.
 * Kept pure (no I/O) so it is fully unit-tested; the DB/env reads happen in the
 * server accessor.
 */
export function resolveFlag(
  key: FeatureFlagKey,
  sources: { envValue?: string; dbValue?: boolean | null },
): boolean {
  const fromEnv = parseBool(sources.envValue);
  if (fromEnv !== undefined) return fromEnv;
  if (sources.dbValue !== undefined && sources.dbValue !== null) return sources.dbValue;
  return FEATURE_FLAGS[key].default;
}
