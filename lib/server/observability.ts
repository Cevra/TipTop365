import * as Sentry from '@sentry/nextjs';

// Thin wrapper so call sites don't import Sentry directly. No-op unless a DSN is
// configured (Sentry.init guards on it). Used by the HTTP error mapper for
// unexpected 500s (plan D21).
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
