import { getSessionUser } from '@/lib/server/auth/session';
import { ok, fail, handler } from '@/lib/server/http';
import { requireDbUser } from '@/lib/server/users';
import { chatMessagesSince, requireChatParty } from '@/lib/server/bookings/chat';
import type { LiveSnapshot } from '@/lib/shared/realtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/bookings/:id/live?cursor= — the D3 polling channel: booking status
 * + chat messages since `cursor` (E4.5). `location` stays null until E4.6
 * wires location_pings. Party-scoped: only the customer or assigned cleaner.
 */
export const GET = handler(async (
  request: Request,
  { params }: { params: { id: string } },
) => {
  const session = await getSessionUser();
  if (!session) return fail('UNAUTHENTICATED', 401);
  const user = await requireDbUser(session);

  const { booking } = await requireChatParty(params.id, user);
  const cursor = new URL(request.url).searchParams.get('cursor');
  const messages = await chatMessagesSince(booking.id, cursor);

  const snapshot: LiveSnapshot = {
    bookingStatus: booking.status,
    location: null, // E4.6
    messages: messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      body: m.body,
      at: m.createdAt.toISOString(),
    })),
    cursor: messages.length > 0 ? messages[messages.length - 1].id : cursor,
  };

  return ok(snapshot, { headers: { 'Cache-Control': 'no-store' } });
});
