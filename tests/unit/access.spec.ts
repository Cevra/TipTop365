import { describe, expect, it } from 'vitest';
import { isProtectedPath, resolveAccess, SESSION_COOKIE } from '@/lib/shared/access';

describe('isProtectedPath', () => {
  it.each([
    ['/book-service', true],
    ['/book-service/step-2', true],
    ['/provider-dashboard', true],
    ['/admin', true],
    ['/admin/disputes/42', true],
    ['/', false],
    ['/login', false],
    ['/usluge', false],
    ['/book-service-info', false], // prefix must be a real segment boundary
    ['/administrators', false],
  ])('%s → %s', (path, expected) => {
    expect(isProtectedPath(path)).toBe(expected);
  });
});

describe('resolveAccess', () => {
  it('lets anonymous users hit public paths', () => {
    expect(resolveAccess('/', false)).toBeNull();
    expect(resolveAccess('/login', false)).toBeNull();
  });

  it('redirects anonymous users off protected paths to login with next=', () => {
    expect(resolveAccess('/book-service', false)).toBe('/login?next=%2Fbook-service');
    expect(resolveAccess('/admin/payouts', false)).toBe('/login?next=%2Fadmin%2Fpayouts');
  });

  it('lets users with a session through protected paths', () => {
    expect(resolveAccess('/book-service', true)).toBeNull();
    expect(resolveAccess('/admin', true)).toBeNull();
  });
});

describe('SESSION_COOKIE', () => {
  it('is the Firebase-mandated name', () => {
    expect(SESSION_COOKIE).toBe('__session');
  });
});
