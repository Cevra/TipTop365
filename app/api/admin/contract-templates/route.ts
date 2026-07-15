import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { WATERMARK_HTML } from '@/lib/domain/contracts/templates';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/contract-templates — all templates, grouped client-side. */
export const GET = handler(async () => {
  await requireRole('admin');
  const templates = await prisma.contractTemplate.findMany({
    orderBy: [{ key: 'asc' }, { legalRegime: 'asc' }, { lang: 'asc' }, { version: 'desc' }],
  });
  return ok({ templates });
});

const editSchema = z.object({
  key: z.string().min(1).max(40),
  legalRegime: z.enum(['fbih', 'fbih_student', 'rs', 'brcko', 'obrt_selfbill']),
  lang: z.enum(['bs', 'en']),
  htmlBody: z.string().min(50).max(50_000),
});

/**
 * POST /api/admin/contract-templates — save an edit as the NEXT version of
 * (key, regime, lang). Published/approved versions are immutable history;
 * new versions always start unapproved and keep the DRAFT watermark
 * (CLAUDE.md: the watermark logic is not removable — it's re-injected here
 * if an edit stripped it).
 */
export const POST = handler(async (request: Request) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const body = await parseBody(request, editSchema);

  const htmlBody = body.htmlBody.includes('draft-watermark')
    ? body.htmlBody
    : `${WATERMARK_HTML}\n${body.htmlBody}`;

  const last = await prisma.contractTemplate.findFirst({
    where: { key: body.key, legalRegime: body.legalRegime, lang: body.lang },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  if (!last) throw new ApiError('TEMPLATE_FAMILY_NOT_FOUND', 404);

  const template = await prisma.contractTemplate.create({
    data: {
      key: body.key,
      legalRegime: body.legalRegime,
      lang: body.lang,
      version: last.version + 1,
      htmlBody,
      lawyerApproved: false,
    },
  });

  await audit({
    actorUserId: admin.id,
    action: 'contract_template.version_created',
    entityType: 'contract_template',
    entityId: template.id,
    after: { key: body.key, legalRegime: body.legalRegime, lang: body.lang, version: template.version },
    ip: clientIp(request),
  });

  return ok({ template }, { status: 201 });
});
