/* eslint-disable no-unused-vars -- base rule false-positives on constructor parameter properties; @typescript-eslint/no-unused-vars still applies */
import 'server-only';
import type { StorageProvider } from '@/lib/server/storage/provider';

// Bunny Storage implementation. Same env contract as scripts/db-dump.mjs:
// BUNNY_STORAGE_ZONE + BUNNY_STORAGE_PASSWORD (the zone AccessKey — a write
// credential, server-only by definition) + optional BUNNY_STORAGE_HOST for
// non-default regions. BUNNY_CDN_HOST is the pull zone that serves the files.
// Lazy like firebaseAdmin: env is read on first use, never at module load, so
// `next build` works without credentials.

class BunnyStorageProvider implements StorageProvider {
  constructor(
    private readonly zone: string,
    private readonly accessKey: string,
    private readonly host: string,
    private readonly cdnHost: string,
  ) {}

  private objectUrl(key: string): string {
    return `https://${this.host}/${this.zone}/${key}`;
  }

  async upload(key: string, body: ArrayBuffer, contentType: string): Promise<void> {
    const res = await fetch(this.objectUrl(key), {
      method: 'PUT',
      headers: { AccessKey: this.accessKey, 'Content-Type': contentType },
      body,
    });
    if (!res.ok) {
      throw new Error(`Bunny upload failed: ${res.status} ${res.statusText}`);
    }
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(this.objectUrl(key), {
      method: 'DELETE',
      headers: { AccessKey: this.accessKey },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Bunny delete failed: ${res.status} ${res.statusText}`);
    }
  }

  publicUrl(key: string): string {
    return `https://${this.cdnHost}/${key}`;
  }
}

let cached: StorageProvider | undefined;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;
  const zone = process.env.BUNNY_STORAGE_ZONE;
  const accessKey = process.env.BUNNY_STORAGE_PASSWORD;
  const cdnHost = process.env.BUNNY_CDN_HOST;
  if (!zone || !accessKey || !cdnHost) {
    throw new Error(
      'Bunny storage not configured: set BUNNY_STORAGE_ZONE, BUNNY_STORAGE_PASSWORD and BUNNY_CDN_HOST.',
    );
  }
  cached = new BunnyStorageProvider(
    zone,
    accessKey,
    process.env.BUNNY_STORAGE_HOST || 'storage.bunnycdn.com',
    cdnHost,
  );
  return cached;
}
