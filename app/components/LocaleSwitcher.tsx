'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

// Minimal bs/en toggle. usePathname() from next-intl returns the locale-less
// path, and router.replace re-adds the chosen locale — so switching keeps the
// user on the same page.
export default function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex items-center gap-1 text-sm" aria-label="Language">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => router.replace(pathname, { locale: loc })}
          aria-current={loc === locale ? 'true' : undefined}
          className={`rounded px-2 py-1 uppercase transition-colors ${
            loc === locale
              ? 'bg-primary-500 text-white'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {loc}
        </button>
      ))}
    </div>
  );
}
