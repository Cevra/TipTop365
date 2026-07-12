import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';
import { resolveAccess, stripLocalePrefix, SESSION_COOKIE } from '@/lib/shared/access';

const intlMiddleware = createIntlMiddleware(routing);

// Two responsibilities, in order:
//   1. Auth gate — redirect anonymous users off protected paths (cookie
//      PRESENCE only; crypto verification is Node-only, done in server guards).
//   2. Locale routing — delegate to next-intl (adds/normalizes the /bs|/en
//      prefix). Runs for every non-excluded request so links stay localized.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathWithoutLocale = stripLocalePrefix(pathname, routing.locales);

  // Dev-only /styleguide (plan §20.2). Gated here at runtime because a page-level
  // env check gets baked into the static prerender and still serves in prod.
  if (pathWithoutLocale === '/styleguide' && process.env.NODE_ENV === 'production') {
    return NextResponse.rewrite(new URL('/_not-found', request.url));
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const redirectTo = resolveAccess(pathWithoutLocale, hasSession);
  if (redirectTo) {
    // Preserve the locale the user was browsing in.
    const segments = pathname.split('/');
    const locale = routing.locales.includes(segments[1] as never)
      ? segments[1]
      : routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}${redirectTo}`, request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  // Skip API routes, Next internals, and files with an extension.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
