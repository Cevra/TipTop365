import * as Sentry from '@sentry/nextjs';

// Edge runtime Sentry (middleware, edge routes). Inert without a DSN.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    release: process.env.NEXT_PUBLIC_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  });
}
