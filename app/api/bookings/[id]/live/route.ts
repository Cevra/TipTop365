import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/auth/session';
import type { LiveSnapshot } from '@/lib/shared/realtime';

export const runtime = 'nodejs';

/**
 * GET /api/bookings/:id/live?cursor=
 * The realtime channel (plan D3 v1.1): booking status + latest location ping +
 * messages since `cursor`. SKELETON — the bookings/chat/location tables land in
 * E1.3 and are wired here in E4.5 (chat) / E4.6 (live map). For now it enforces
 * auth and returns an empty, correctly-shaped snapshot so the client hook and
 * its consumers can be built against the real contract.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  if (!params.id) {
    return NextResponse.json({ error: 'MISSING_BOOKING_ID' }, { status: 400 });
  }

  const cursor = new URL(request.url).searchParams.get('cursor');

  // TODO(E1.3/E4): load the booking, assert the caller is a party to it, and
  // return real status/location/messages-since-cursor from Postgres.
  const snapshot: LiveSnapshot = {
    bookingStatus: null,
    location: null,
    messages: [],
    cursor: cursor ?? null,
  };

  return NextResponse.json(
    { data: snapshot },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
