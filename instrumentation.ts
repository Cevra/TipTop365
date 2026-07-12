import * as Sentry from '@sentry/nextjs';

// Next.js instrumentation hook — loads the runtime-appropriate Sentry config.
// Both are inert without a DSN (see the config files).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Report React Server Component / route errors to Sentry (no-op without a DSN).
export const onRequestError = Sentry.captureRequestError;
