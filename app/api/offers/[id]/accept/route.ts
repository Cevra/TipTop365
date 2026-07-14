import { ok, handler } from '@/lib/server/http';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { acceptOffer } from '@/lib/server/bookings/broadcast';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

/**
 * POST /api/offers/:id/accept — first-accept wins (§3 step 5). The FSM's
 * status-guarded update resolves races: exactly one accept succeeds, the
 * rest get 409s and their offers flip to lost_race.
 */
export const POST = handler(async (_request: Request, { params }: Ctx) => {
  const user = await requireDbUser(await requireSession());
  const booking = await acceptOffer(params.id, user.id);
  return ok({ booking });
});
