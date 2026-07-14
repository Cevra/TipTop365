/* eslint-disable no-unused-vars -- base rule false-positives on interface params; @typescript-eslint/no-unused-vars still applies */
// Storage abstraction (plan §1.1): Bunny today, anything tomorrow. Keys are
// zone-relative paths ("profile-images/<uid>/<file>"). The full private-zone +
// signed-URL machinery is E4; this seam exists so the profile-image endpoint
// (and later the photo pipeline) never talk to a vendor API directly.

export interface StorageProvider {
  /** PUT `body` at `key`, overwriting. Throws on non-2xx. */
  upload(key: string, body: ArrayBuffer, contentType: string): Promise<void>;
  /** DELETE `key`. Missing objects are not an error. */
  delete(key: string): Promise<void>;
  /** Public CDN URL for `key` (public-zone objects only, e.g. avatars). */
  publicUrl(key: string): string;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.-]/g, '_');
}

/** Storage key for a fresh profile image upload. */
export function profileImageKey(uid: string, fileName: string, now = Date.now()): string {
  return `profile-images/${uid}/${now}-${sanitizeFileName(fileName)}`;
}

/**
 * Derive the storage key from a previously-issued public URL, accepting it
 * only if it points inside the caller's own profile-image folder — the only
 * thing the profile endpoint may delete. Returns null for foreign folders,
 * traversal attempts, or unparseable URLs (caller then simply skips the
 * delete; a leaked old file is the lesser failure).
 */
export function ownedProfileImageKey(url: string, uid: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '');
  } catch {
    return null;
  }
  if (!path.startsWith(`profile-images/${uid}/`)) return null;
  if (path.includes('..') || path.includes('//')) return null;
  return path;
}
