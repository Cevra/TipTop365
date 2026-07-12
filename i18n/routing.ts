import { defineRouting } from 'next-intl/routing';

// Bosnian is the default and unprefixed-fallback locale (plan D9).
export const routing = defineRouting({
  locales: ['bs', 'en'],
  defaultLocale: 'bs',
});

export type Locale = (typeof routing.locales)[number];
