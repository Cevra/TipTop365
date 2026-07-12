import * as Sentry from '@sentry/nextjs';

// Server-side Sentry (plan D21). Inert unless NEXT_PUBLIC_SENTRY_DSN is set, so
// builds and local dev without a DSN are unaffected. Release is tagged from the
// deploy SHA for per-release error grouping.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    release: process.env.NEXT_PUBLIC_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  });
}
