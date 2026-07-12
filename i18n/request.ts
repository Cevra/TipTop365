import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

// Loads the message bundle for the resolved locale on each request. Referenced
// by the next-intl plugin in next.config.mjs.
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as never)) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
