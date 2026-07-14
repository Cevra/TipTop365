import 'server-only';
import type { User } from '@prisma/client';
import { prisma } from '@/lib/server/db';
import { ApiError } from '@/lib/server/http';
import type { SessionClaims } from '@/lib/shared/access';

// Bridge from a verified Firebase session to the Postgres user row (system of
// record, D3). Legacy accounts predate the E1.1 backfill --commit, so rows are
// provisioned on first authenticated API use; role comes from the verified
// custom claim, never from client input.

export async function requireDbUser(session: SessionClaims): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { firebaseUid: session.uid } });
  if (existing) return existing;

  if (!session.email) {
    // No email on the token and no backfilled row — cannot provision a unique row.
    throw new ApiError('USER_NOT_PROVISIONED', 409);
  }
  return prisma.user.upsert({
    where: { firebaseUid: session.uid },
    create: {
      firebaseUid: session.uid,
      email: session.email,
      role: session.role === 'admin' ? 'admin' : session.role === 'cleaner' ? 'cleaner' : 'customer',
    },
    update: {},
  });
}
