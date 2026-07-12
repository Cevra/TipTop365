import 'server-only';
import { adminAuth } from '@/lib/server/firebaseAdmin';
import type { AppRole } from '@/lib/shared/access';

/**
 * Set a user's custom claims (role + verified badge). These are embedded in the
 * ID token and session cookie, so they must be refreshed client-side (token
 * refresh) or via a new session after changing. Called by admin flows (E9) and
 * the verification pipeline; kept here so there is one authoritative writer.
 */
export async function setUserClaims(
  uid: string,
  claims: { role: AppRole; verified?: boolean },
): Promise<void> {
  await adminAuth().setCustomUserClaims(uid, {
    role: claims.role,
    verified: claims.verified ?? false,
  });
}
