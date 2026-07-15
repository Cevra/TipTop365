import { ok } from '@/lib/server/http';
import { getSessionUser } from '@/lib/server/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/me — current session claims (or null). Exists so client chrome
 * (impersonation banner, nav state) can ask cheaply without forcing the
 * statically-rendered locale layout dynamic.
 */
export async function GET() {
  const session = await getSessionUser();
  return ok({
    session: session
      ? {
          uid: session.uid,
          role: session.role,
          verified: session.verified,
          impersonatedBy: session.impersonatedBy ?? null,
        }
      : null,
  });
}
