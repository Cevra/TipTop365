import * as Sentry from '@sentry/nextjs';

// Browser Sentry (plan D21). Inert without a DSN. Session replay is enabled at a
// low sample rate only when a DSN is configured.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    release: process.env.NEXT_PUBLIC_RELEASE,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  });
}
