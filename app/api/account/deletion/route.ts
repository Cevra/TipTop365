import { ok, handler, ApiError } from '@/lib/server/http';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/account/deletion — my open/most recent request. */
export const GET = handler(async () => {
  const user = await requireDbUser(await requireSession());
  const request_ = await prisma.deletionRequest.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  return ok({ request: request_ });
});

/**
 * POST /api/account/deletion — right-to-delete request (§8.5). One open
 * request per user; blocked while the user has bookings in flight (they must
 * finish or cancel first — money and FSM state can't be anonymized mid-job).
 */
export const POST = handler(async (request: Request) => {
  const user = await requireDbUser(await requireSession());

  const open = await prisma.deletionRequest.findFirst({
    where: { userId: user.id, status: 'open' },
  });
  if (open) return ok({ request: open }); // idempotent

  const inFlight = await prisma.booking.count({
    where: {
      OR: [{ customerId: user.id }, { cleaner: { userId: user.id } }],
      status: { in: ['pending_payment', 'matching', 'accepted', 'on_my_way', 'in_progress', 'pending_completion', 'disputed'] },
    },
  });
  if (inFlight > 0) throw new ApiError('BOOKINGS_IN_FLIGHT', 409, { count: inFlight });

  const deletionRequest = await prisma.deletionRequest.create({ data: { userId: user.id } });
  await audit({
    actorUserId: user.id,
    action: 'account.deletion_requested',
    entityType: 'deletion_request',
    entityId: deletionRequest.id,
    ip: clientIp(request),
  });
  return ok({ request: deletionRequest }, { status: 201 });
});
