import { ok, handler, ApiError } from '@/lib/server/http';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { walletStatus } from '@/lib/server/wallet';

export const runtime = 'nodejs';
// Session cookie read → never statically prerenderable.
export const dynamic = 'force-dynamic';

/** GET /api/wallet — the calling cleaner's balances (E5.4 UI reads this). */
export const GET = handler(async () => {
  const user = await requireDbUser(await requireSession());
  const profile = await prisma.cleanerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new ApiError('NOT_A_CLEANER', 403);
  return ok(await walletStatus(profile.id));
});
