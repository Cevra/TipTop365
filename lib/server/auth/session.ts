import 'server-only';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/server/firebaseAdmin';
import { SESSION_COOKIE, type AppRole, type SessionClaims } from '@/lib/shared/access';

// Re-exported for server-side callers that already import from this module.
export { SESSION_COOKIE };

// 5 days, matching a typical "keep me signed in" window. Firebase caps session
// cookies at 14 days.
export const SESSION_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

/** Exchange a freshly-minted Firebase ID token for a durable session cookie. */
export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
}

/**
 * Verify the session cookie and project it onto our claim shape. `checkRevoked`
 * catches sign-out / disabled accounts. Returns null on any failure — callers
 * treat null as "not authenticated".
 */
export async function verifySession(cookie: string | undefined): Promise<SessionClaims | null> {
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, true);
    return {
      uid: decoded.uid,
      role: (decoded.role as AppRole) ?? 'customer',
      verified: Boolean(decoded.verified),
      email: decoded.email,
      impersonatedBy: typeof decoded.impersonatedBy === 'string' ? decoded.impersonatedBy : undefined,
    };
  } catch {
    return null;
  }
}

/** Read + verify the current request's session cookie (server components / route handlers). */
export async function getSessionUser(): Promise<SessionClaims | null> {
  return verifySession(cookies().get(SESSION_COOKIE)?.value);
}

/** Guard: return the session or throw 401-shaped error. */
export async function requireSession(): Promise<SessionClaims> {
  const session = await getSessionUser();
  if (!session) throw new AuthError('UNAUTHENTICATED', 401);
  return session;
}

/** Guard: require one of the given roles or throw 403-shaped error. */
export async function requireRole(...roles: AppRole[]): Promise<SessionClaims> {
  const session = await requireSession();
  if (!roles.includes(session.role)) throw new AuthError('FORBIDDEN', 403);
  return session;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
