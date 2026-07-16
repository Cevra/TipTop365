import { z } from 'zod';
import { ok, handler } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';

const bodySchema = z.object({
  audience: z.enum(['all', 'customers', 'cleaners', 'hosts']),
  channel: z.enum(['push', 'email']),
  title: z.string().min(3).max(120),
  body: z.string().min(3).max(2000),
});

/**
 * POST /api/admin/campaigns (E9.6, §8 "push/email campaign blast") — enqueues
 * one D10 outbox notification per active target user. DELIVERY is E10.1's
 * dispatcher: rows sit `pending` until it ships, which makes campaigns safe
 * to stage today and exactly-once later. Audited with the queued count.
 */
export const POST = handler(async (request: Request) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const body = await parseBody(request, bodySchema);

  const where = {
    status: 'active' as const,
    ...(body.audience === 'customers' ? { role: 'customer' as const } : {}),
    ...(body.audience === 'cleaners' ? { role: 'cleaner' as const } : {}),
    ...(body.audience === 'hosts' ? { isHost: true } : {}),
  };
  const targets = await prisma.user.findMany({ where, select: { id: true } });

  const { count } = await prisma.notification.createMany({
    data: targets.map((target) => ({
      userId: target.id,
      eventKey: 'campaign.blast',
      channel: body.channel,
      payload: { title: body.title, body: body.body, audience: body.audience },
    })),
  });

  await audit({
    actorUserId: admin.id,
    action: 'campaign.queued',
    entityType: 'campaign',
    entityId: `campaign:${Date.now()}`,
    after: { audience: body.audience, channel: body.channel, title: body.title, queued: count },
    ip: clientIp(request),
  });

  return ok({ queued: count }, { status: 201 });
});
