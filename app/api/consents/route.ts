import { z } from 'zod';
import { ok, handler } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { missingConsents, POLICY_VERSIONS } from '@/lib/domain/consents';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/consents — my consent history + current versions + what's missing. */
export const GET = handler(async () => {
  const user = await requireDbUser(await requireSession());
  const consents = await prisma.consent.findMany({
    where: { userId: user.id },
    orderBy: { grantedAt: 'desc' },
  });
  return ok({
    consents,
    versions: POLICY_VERSIONS,
    missing: missingConsents(consents),
  });
});

const postSchema = z.object({ kind: z.enum(['tos', 'privacy', 'photos', 'marketing']) });

/** POST /api/consents — record consent for the CURRENT policy version (append-only). */
export const POST = handler(async (request: Request) => {
  const user = await requireDbUser(await requireSession());
  const { kind } = await parseBody(request, postSchema);

  const version = POLICY_VERSIONS[kind];
  const existing = await prisma.consent.findFirst({ where: { userId: user.id, kind, version } });
  if (existing) return ok({ consent: existing }); // idempotent per version

  const consent = await prisma.consent.create({
    data: { userId: user.id, kind, version, grantedAt: new Date(), ip: clientIp(request) },
  });
  return ok({ consent }, { status: 201 });
});
