import { adminAuth } from '@/lib/server/firebaseAdmin';
import { AuthError, getSessionUser } from '@/lib/server/auth/session';
import { ok, fail, ApiError, handler } from '@/lib/server/http';
import { rateLimit, RATE_LIMITS } from '@/lib/server/rateLimit';
import { getStorageProvider } from '@/lib/server/storage/bunny';
import { ownedProfileImageKey, profileImageKey } from '@/lib/server/storage/provider';

// firebase-admin needs the Node runtime (not Edge).
export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Session cookie first; Bearer ID token as fallback because the legacy profile
 * pages authenticate with the Firebase client SDK only and don't yet call
 * startSession (utils/session.ts) — remove the fallback once E11 wires that up.
 */
async function requireUploader(request: Request): Promise<string> {
  const session = await getSessionUser();
  if (session) return session.uid;

  const authz = request.headers.get('authorization');
  if (authz?.startsWith('Bearer ')) {
    try {
      const decoded = await adminAuth().verifyIdToken(authz.slice('Bearer '.length));
      return decoded.uid;
    } catch {
      // fall through to 401
    }
  }
  throw new AuthError('UNAUTHENTICATED', 401);
}

/**
 * POST /api/profile/image — multipart form: `file` (image, ≤5 MB) + optional
 * `previousUrl` (the avatar being replaced; deleted best-effort, and only if
 * it lives in the caller's own profile-images folder). Returns { url }.
 * Replaces the client-side Bunny calls that shipped the storage AccessKey to
 * every browser (secrets stay server-side, CLAUDE.md).
 */
export const POST = handler(async (request: Request) => {
  const uid = await requireUploader(request);

  const { allowed, retryAfterSec } = rateLimit(`upload:${uid}`, RATE_LIMITS.upload);
  if (!allowed) {
    return fail('RATE_LIMITED', 429, { retryAfterSec });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError('INVALID_FORM_DATA', 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) throw new ApiError('MISSING_FILE', 400);
  if (!file.type.startsWith('image/')) throw new ApiError('UNSUPPORTED_MEDIA_TYPE', 415);
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ApiError('FILE_TOO_LARGE', 413, { maxBytes: MAX_IMAGE_BYTES });
  }

  const storage = getStorageProvider();

  const previousUrl = form.get('previousUrl');
  if (typeof previousUrl === 'string' && previousUrl) {
    const oldKey = ownedProfileImageKey(previousUrl, uid);
    if (oldKey) {
      // Best-effort: a stale old file must not block the new upload.
      await storage.delete(oldKey).catch((err) => {
        console.error('Failed to delete previous profile image:', err);
      });
    }
  }

  const key = profileImageKey(uid, file.name);
  await storage.upload(key, await file.arrayBuffer(), file.type);

  return ok({ url: storage.publicUrl(key) });
});
