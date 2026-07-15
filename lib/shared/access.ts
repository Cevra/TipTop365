// Access model — pure, no I/O, unit-tested. Shared by middleware (edge) and
// server guards (node). Middleware does a cheap cookie-PRESENCE gate for
// redirects; cryptographic verification of the session cookie happens in Node
// server helpers (verifySession), never at the edge.

// Firebase requires this exact cookie name ("__session") to be forwarded by
// some hosting CDNs; we adopt it everywhere. Lives here (pure module) so the
// Edge middleware can import it without pulling in Node-only server code.
export const SESSION_COOKIE = '__session';

export type AppRole = 'customer' | 'cleaner' | 'admin';

export interface SessionClaims {
  uid: string;
  role: AppRole;
  verified: boolean;
  /** From the Firebase token when present — used to provision the Postgres user row. */
  email?: string;
  /** Admin uid when this session was minted via support impersonation (E9.4). */
  impersonatedBy?: string;
}

// Route prefixes that require an authenticated session. Admin additionally
// requires the admin role, enforced server-side (middleware can't read claims
// without verifying, which is Node-only). E0.4 introduces the (app)/(admin)
// route groups; these URL prefixes are the stable contract.
export const PROTECTED_PREFIXES = [
  '/book-service',
  '/provider-dashboard',
  '/admin',
  '/properties',
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Remove a leading locale segment (`/bs/book-service` → `/book-service`) so
 * access checks are locale-agnostic. Returns `/` when the path is just the
 * locale root (`/bs` → `/`). Pure; locales injected to avoid importing routing.
 */
export function stripLocalePrefix(pathname: string, locales: readonly string[]): string {
  const segments = pathname.split('/');
  if (segments.length >= 2 && locales.includes(segments[1])) {
    const rest = '/' + segments.slice(2).join('/');
    return rest === '/' ? '/' : rest.replace(/\/$/, '');
  }
  return pathname;
}

/**
 * Decides where an incoming request should go based only on the path and
 * whether a session cookie is present. Returns a redirect target, or null to
 * proceed. Kept pure so middleware behavior is fully unit-testable.
 */
export function resolveAccess(pathname: string, hasSession: boolean): string | null {
  if (!isProtectedPath(pathname)) return null;
  if (!hasSession) {
    const next = encodeURIComponent(pathname);
    return `/login?next=${next}`;
  }
  return null;
}
