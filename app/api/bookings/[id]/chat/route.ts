import { z } from 'zod';
import { ok, fail, handler } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { rateLimit, RATE_LIMITS } from '@/lib/server/rateLimit';
import { sendChatMessage } from '@/lib/server/bookings/chat';

export const runtime = 'nodejs';

const bodySchema = z.object({ body: z.string().min(1).max(2000) });

type Ctx = { params: { id: string } };

/**
 * POST /api/bookings/:id/chat (E4.5, §12.4) — party-scoped, masked at write
 * time (the raw body never touches the DB), per-user rate-limited. Reads go
 * through GET /api/bookings/:id/live (D3 polling channel).
 */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const user = await requireDbUser(await requireSession());
  const { allowed, retryAfterSec } = rateLimit(`chat:${user.id}`, RATE_LIMITS.chat);
  if (!allowed) return fail('RATE_LIMITED', 429, { retryAfterSec });

  const { body } = await parseBody(request, bodySchema);
  const { message, wasMasked } = await sendChatMessage({ bookingId: params.id, sender: user, body });
  return ok({ message, wasMasked }, { status: 201 });
});
