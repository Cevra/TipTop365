import { z } from 'zod';
import { ok, handler } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { setFlag } from '@/lib/server/featureFlags';
import { FEATURE_FLAGS, FEATURE_FLAG_KEYS, flagEnvVar } from '@/lib/shared/featureFlags';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/flags — typed flags with default/DB/env-override state (D12). */
export const GET = handler(async () => {
  await requireRole('admin');
  const rows = await prisma.featureFlag.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r.enabled]));
  return ok({
    flags: FEATURE_FLAG_KEYS.map((key) => ({
      key,
      description: FEATURE_FLAGS[key].description,
      default: FEATURE_FLAGS[key].default,
      dbValue: byKey.get(key) ?? null,
      envOverride: process.env[flagEnvVar(key)] ?? null,
    })),
  });
});

const postSchema = z.object({
  key: z.enum(FEATURE_FLAG_KEYS as [string, ...string[]]),
  enabled: z.boolean(),
});

/** POST /api/admin/flags — set the DB value (env override still wins, D12). */
export const POST = handler(async (request: Request) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const body = await parseBody(request, postSchema);

  await setFlag(body.key as (typeof FEATURE_FLAG_KEYS)[number], body.enabled);
  await audit({
    actorUserId: admin.id,
    action: 'feature_flag.set',
    entityType: 'feature_flag',
    entityId: body.key,
    after: { enabled: body.enabled },
    ip: clientIp(request),
  });
  return ok({ key: body.key, enabled: body.enabled });
});
