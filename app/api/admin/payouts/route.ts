import { z } from 'zod';
import { ok, handler } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { isoWeekLabel, preparePayoutRun } from '@/lib/server/payouts';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/payouts — runs newest-first with payout rows. */
export const GET = handler(async () => {
  await requireRole('admin');
  const runs = await prisma.payoutRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: 26,
    include: {
      payouts: { include: { cleaner: { include: { user: { select: { firstName: true, lastName: true } } } } } },
    },
  });
  return ok({ runs });
});

const prepareSchema = z.object({ weekLabel: z.string().regex(/^\d{4}-W\d{2}$/).optional() });

/** POST /api/admin/payouts — prepare this week's run (draft), audited. */
export const POST = handler(async (request: Request) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const { weekLabel } = await parseBody(request, prepareSchema);

  const label = weekLabel ?? isoWeekLabel();
  const { run, skipped } = await preparePayoutRun(label, admin.id);

  await audit({
    actorUserId: admin.id,
    action: 'payouts.run_prepared',
    entityType: 'payout_run',
    entityId: run.id,
    after: { weekLabel: label, totalsF: run.totalsF, payouts: run.payouts.length, skipped },
    ip: clientIp(request),
  });

  return ok({ run, skipped }, { status: 201 });
});
