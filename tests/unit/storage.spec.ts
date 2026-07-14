import { describe, expect, it } from 'vitest';
import {
  ownedProfileImageKey,
  profileImageKey,
  sanitizeFileName,
} from '@/lib/server/storage/provider';

describe('sanitizeFileName', () => {
  it('keeps safe characters and replaces the rest', () => {
    expect(sanitizeFileName('moja slika (1).jpg')).toBe('moja_slika__1_.jpg');
    expect(sanitizeFileName('avatar.png')).toBe('avatar.png');
  });
});

describe('profileImageKey', () => {
  it('namespaces by uid and timestamps the file', () => {
    expect(profileImageKey('uid-1', 'me & you.png', 1700000000000)).toBe(
      'profile-images/uid-1/1700000000000-me___you.png',
    );
  });
});

describe('ownedProfileImageKey', () => {
  const uid = 'uid-1';

  it('accepts a URL inside the caller’s own folder, on any CDN host', () => {
    expect(
      ownedProfileImageKey('https://tiptop-365.b-cdn.net/profile-images/uid-1/123-a.png', uid),
    ).toBe('profile-images/uid-1/123-a.png');
    expect(
      ownedProfileImageKey('https://tiptop-storage.b-cdn.net/profile-images/uid-1/123-a.png', uid),
    ).toBe('profile-images/uid-1/123-a.png');
  });

  it('rejects another user’s folder', () => {
    expect(
      ownedProfileImageKey('https://tiptop-365.b-cdn.net/profile-images/uid-2/123-a.png', uid),
    ).toBeNull();
  });

  it('rejects paths outside profile-images', () => {
    expect(ownedProfileImageKey('https://tiptop-365.b-cdn.net/backups/db.dump', uid)).toBeNull();
  });

  it('rejects traversal, including percent-encoded', () => {
    expect(
      ownedProfileImageKey('https://x.b-cdn.net/profile-images/uid-1/../../db.dump', uid),
    ).toBeNull();
    expect(
      ownedProfileImageKey('https://x.b-cdn.net/profile-images/uid-1/%2e%2e/db.dump', uid),
    ).toBeNull();
  });

  it('rejects unparseable URLs and malformed encodings', () => {
    expect(ownedProfileImageKey('not a url', uid)).toBeNull();
    expect(ownedProfileImageKey('https://x.b-cdn.net/profile-images/uid-1/%E0%A4%A', uid)).toBeNull();
  });
});
