import { z } from 'zod';
import { NextResponse } from 'next/server';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody, parseQuery } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { markRunPaid, payoutRunCsv } from '@/lib/server/payouts';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';

type Ctx = { params: { id: string } };

const getSchema = z.object({ format: z.literal('csv') });

/** GET /api/admin/payouts/:id?format=csv — bank-upload file; flips draft→exported. */
export const GET = handler(async (request: Request, { params }: Ctx) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  parseQuery(request.url, getSchema);

  const { filename, csv } = await payoutRunCsv(params.id);
  await audit({
    actorUserId: admin.id,
    action: 'payouts.csv_exported',
    entityType: 'payout_run',
    entityId: params.id,
    ip: clientIp(request),
  });
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});

const actionSchema = z.object({ action: z.literal('mark_paid') });

/** POST /api/admin/payouts/:id — mark paid → idempotent §7 payout postings. */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const { action } = await parseBody(request, actionSchema);
  if (action !== 'mark_paid') throw new ApiError('UNKNOWN_ACTION', 400);

  const { run, posted } = await markRunPaid(params.id);
  await audit({
    actorUserId: admin.id,
    action: 'payouts.run_paid',
    entityType: 'payout_run',
    entityId: run.id,
    after: { posted, totalsF: run.totalsF },
    ip: clientIp(request),
  });
  return ok({ run, posted });
});
