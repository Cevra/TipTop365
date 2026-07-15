import { z } from 'zod';
import { ok, handler, ApiError } from '@/lib/server/http';
import { parseBody } from '@/lib/server/validation';
import { requireRole } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';
import { audit } from '@/lib/server/audit';
import { clientIp } from '@/lib/server/requestIp';
import { setUserClaims } from '@/lib/server/auth/claims';

export const runtime = 'nodejs';

const bodySchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('schedule'),
    interviewAt: z.coerce.date(),
    mode: z.enum(['video', 'in_person']),
  }),
  z.object({
    op: z.literal('checklist'),
    checklist: z.object({
      id_verified: z.boolean(),
      references_checked: z.boolean(),
      trial_cleaning: z.boolean().optional(),
      notes: z.string().max(2000).optional(),
    }),
  }),
  z.object({ op: z.literal('approve') }),
  z.object({ op: z.literal('reject'), reason: z.string().min(1).max(500) }),
]);

type Ctx = { params: { id: string } };

/**
 * PATCH /api/admin/verification/:id (E9.3, §2/§8): the pipeline —
 * schedule interview → record checklist → approve (grants the Verified ✓
 * badge, `id_checked` from the checklist, and the `verified` Firebase custom
 * claim via the single authoritative claims writer) or reject. Every op audited.
 * Approval requires `id_verified` on file (§2: "ID-checked badge").
 */
export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const session = await requireRole('admin');
  const admin = await requireDbUser(session);
  const body = await parseBody(request, bodySchema);

  const application = await prisma.verificationApplication.findUnique({
    where: { id: params.id },
    include: { cleaner: { include: { cleanerProfile: true } } },
  });
  if (!application) throw new ApiError('APPLICATION_NOT_FOUND', 404);
  if (application.status === 'approved' || application.status === 'rejected') {
    throw new ApiError('APPLICATION_CLOSED', 409, { status: application.status });
  }

  const before = { status: application.status };
  let after: Record<string, unknown>;

  if (body.op === 'schedule') {
    await prisma.verificationApplication.update({
      where: { id: application.id },
      data: { status: 'interview_scheduled', interviewAt: body.interviewAt, interviewMode: body.mode },
    });
    after = { status: 'interview_scheduled', interviewAt: body.interviewAt.toISOString(), mode: body.mode };
  } else if (body.op === 'checklist') {
    await prisma.verificationApplication.update({
      where: { id: application.id },
      data: { status: 'checklist', checklist: body.checklist },
    });
    after = { status: 'checklist', checklist: body.checklist };
  } else if (body.op === 'approve') {
    const checklist = application.checklist as { id_verified?: boolean } | null;
    if (!checklist?.id_verified) {
      throw new ApiError('CHECKLIST_ID_NOT_VERIFIED', 409);
    }
    if (!application.cleaner.cleanerProfile) throw new ApiError('CLEANER_PROFILE_MISSING', 409);

    await prisma.$transaction([
      prisma.verificationApplication.update({
        where: { id: application.id },
        data: { status: 'approved', reviewedById: admin.id },
      }),
      prisma.cleanerProfile.update({
        where: { id: application.cleaner.cleanerProfile.id },
        data: { tier: 'verified', verifiedAt: new Date(), idChecked: true },
      }),
    ]);
    // Custom claim → session tokens carry verified=true after refresh (D4).
    await setUserClaims(application.cleaner.firebaseUid, { role: 'cleaner', verified: true });
    after = { status: 'approved', tier: 'verified' };
  } else {
    await prisma.verificationApplication.update({
      where: { id: application.id },
      data: { status: 'rejected', reviewedById: admin.id, rejectionReason: body.reason },
    });
    after = { status: 'rejected', reason: body.reason };
  }

  await audit({
    actorUserId: admin.id,
    action: `verification.${body.op}`,
    entityType: 'verification_application',
    entityId: application.id,
    before,
    after,
    ip: clientIp(request),
  });

  const updated = await prisma.verificationApplication.findUniqueOrThrow({
    where: { id: params.id },
  });
  return ok({ application: updated });
});
