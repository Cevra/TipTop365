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
}

// Route prefixes that require an authenticated session. Admin additionally
// requires the admin role, enforced server-side (middleware can't read claims
// without verifying, which is Node-only). E0.4 introduces the (app)/(admin)
// route groups; these URL prefixes are the stable contract.
export const PROTECTED_PREFIXES = ['/book-service', '/provider-dashboard', '/admin'] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
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
