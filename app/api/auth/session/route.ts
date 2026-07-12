import { NextResponse } from 'next/server';
import { createSessionCookie, SESSION_COOKIE, SESSION_MAX_AGE_MS } from '@/lib/server/auth/session';

// firebase-admin needs the Node runtime (not Edge).
export const runtime = 'nodejs';

/**
 * POST /api/auth/session
 * Body: { idToken } — a fresh Firebase ID token from the client SDK.
 * Sets an httpOnly `__session` cookie the server can verify on every request.
 */
export async function POST(request: Request) {
  let idToken: unknown;
  try {
    ({ idToken } = await request.json());
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 });
  }

  if (typeof idToken !== 'string' || idToken.length === 0) {
    return NextResponse.json({ error: 'MISSING_ID_TOKEN' }, { status: 400 });
  }

  try {
    const cookie = await createSessionCookie(idToken);
    const res = NextResponse.json({ data: { ok: true } });
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
    return NextResponse.json({ error: 'INVALID_ID_TOKEN' }, { status: 401 });
  }
}

/** DELETE /api/auth/session — clear the session cookie (logout). */
export async function DELETE() {
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
