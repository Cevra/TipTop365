import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveAccess, SESSION_COOKIE } from '@/lib/shared/access';

// Edge middleware does a cheap cookie-PRESENCE gate to redirect anonymous users
// away from protected paths. It intentionally does NOT verify the cookie:
// firebase-admin verification is Node-only. Cryptographic verification + role
// enforcement happen in server components / route handlers via getSessionUser()
// and requireRole() (plan D4). A forged-but-present cookie gets past middleware
// and is then rejected server-side — never trusted for data access.
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const redirectTo = resolveAccess(request.nextUrl.pathname, hasSession);

  if (redirectTo) {
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except static assets and Next internals.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
