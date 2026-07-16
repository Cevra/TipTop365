import { afterAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { SessionClaims } from '@/lib/shared/access';
import { __resetRateLimits } from '@/lib/server/rateLimit';

const sessionState: { current: SessionClaims | null } = { current: null };

vi.mock('@/lib/server/auth/session', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/server/auth/session')>();
  return {
    ...original,
    requireSession: vi.fn(async () => {
      if (!sessionState.current) throw new original.AuthError('UNAUTHENTICATED', 401);
      return sessionState.current;
    }),
  };
});

import { POST as confirmPost } from '@/app/api/bookings/[id]/confirm/route';
import { POST as createBooking } from '@/app/api/bookings/route';

const prisma = new PrismaClient();
const stamp = `it${Date.now() % 1e9}`;
const claims: SessionClaims = {
  uid: `fb-${stamp}-rl`,
  role: 'customer',
  verified: false,
  email: `rl-${stamp}@test.local`,
};

function emptyPost(): Request {
  return new Request('http://test.local/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: stamp } } });
  await prisma.$disconnect();
});

describe('per-user rate limits on money endpoints (E12.3)', () => {
  it('confirm 429s on the 6th attempt (payment preset, capacity 5)', async () => {
    __resetRateLimits();
    sessionState.current = claims;
    let last = 0;
    for (let i = 0; i < 6; i++) {
      // Empty body fails validation AFTER the limiter — fast, no DB writes.
      last = (await confirmPost(emptyPost(), { params: { id: 'whatever' } })).status;
    }
    expect(last).toBe(429);
  });

  it('booking creation 429s on the 11th attempt (booking preset, capacity 10)', async () => {
    __resetRateLimits();
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await createBooking(emptyPost())).status;
    }
    expect(last).toBe(429);
  });
});
