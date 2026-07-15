import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';

export const runtime = 'nodejs';

const bodySchema = z.object({ approved: z.boolean() });

type Ctx = { params: { id: string } };

/**
 * POST /api/admin/contract-templates/:id/approve — the lawyer_approved flip
 * (§8: templates ship watermarked until this is set). Heavily audited — this
 * is THE legal-compliance switch. E7.2's renderer drops the watermark only
 * when the version used is approved.
 */
export const POST = handler(async (request: Request, { params }: Ctx) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const { approved } = await parseBody(request, bodySchema);

  const template = await prisma.contractTemplate.findUnique({ where: { id: params.id } });
  if (!template) throw new ApiError('TEMPLATE_NOT_FOUND', 404);

  const updated = await prisma.contractTemplate.update({
    where: { id: template.id },
    data: { lawyerApproved: approved },
  });

  await audit({
    actorUserId: admin.id,
    action: approved ? 'contract_template.approved' : 'contract_template.approval_revoked',
    entityType: 'contract_template',
    entityId: template.id,
    before: { lawyerApproved: template.lawyerApproved },
    after: { lawyerApproved: approved, key: template.key, legalRegime: template.legalRegime, lang: template.lang, version: template.version },
    ip: clientIp(request),
  });

  return ok({ template: updated });
});
