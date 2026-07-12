import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSessionCookie, SESSION_COOKIE, SESSION_MAX_AGE_MS } from '@/lib/server/auth/session';
import { ok, fail, ApiError, handler } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { rateLimit, RATE_LIMITS } from '@/lib/server/rateLimit';

// firebase-admin needs the Node runtime (not Edge).
export const runtime = 'nodejs';

const bodySchema = z.object({ idToken: z.string().min(1) });

function clientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * POST /api/auth/session
 * Body: { idToken } — a fresh Firebase ID token from the client SDK.
 * Sets an httpOnly `__session` cookie the server can verify on every request.
 * Rate-limited per IP (auth preset).
 */
export const POST = handler(async (request: Request) => {
  const { allowed, retryAfterSec } = rateLimit(`auth:${clientIp(request)}`, RATE_LIMITS.auth);
  if (!allowed) {
    return fail('RATE_LIMITED', 429, { retryAfterSec });
  }

  const { idToken } = await parseBody(request, bodySchema);

  try {
    const cookie = await createSessionCookie(idToken);
    const res = ok({ ok: true });
    res.cookies.set(SESSION_COOKIE, cookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
    });
    return res;
  } catch {
    // Bad/expired ID token, or admin credentials not configured.
    throw new ApiError('INVALID_ID_TOKEN', 401);
  }
});

/** DELETE /api/auth/session — clear the session cookie (logout). */
export function DELETE(): NextResponse {
  const res = ok({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
