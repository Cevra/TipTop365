import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'randomuser.me',
        pathname: '/api/portraits/**',
      },
    ],
  },
};

const base = withNextIntl(nextConfig);

// Only wrap with Sentry when a source-map upload token is present, so ordinary
// builds (dev, CI without secrets) stay clean and fast (plan D21).
export default process.env.SENTRY_AUTH_TOKEN
  ? withSentryConfig(base, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    })
  : base;
