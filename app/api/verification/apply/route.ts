import { ok, handler, ApiError } from '@/lib/server/http';
import { requireSession } from '@/lib/server/auth/session';
import { requireDbUser } from '@/lib/server/users';
import { prisma } from '@/lib/server/db';

export const runtime = 'nodejs';

/**
 * POST /api/verification/apply (E9.3, §2) — a registered cleaner applies for
 * the Verified ✓ tier. One open application at a time.
 */
export const POST = handler(async () => {
  const user = await requireDbUser(await requireSession());
  const profile = await prisma.cleanerProfile.findUnique({ where: { userId: user.id } });
  if (!profile) throw new ApiError('NOT_A_CLEANER', 403);
  if (profile.tier === 'verified') throw new ApiError('ALREADY_VERIFIED', 409);

  const open = await prisma.verificationApplication.findFirst({
    where: { cleanerId: user.id, status: { in: ['applied', 'interview_scheduled', 'checklist'] } },
  });
  if (open) throw new ApiError('APPLICATION_ALREADY_OPEN', 409, { applicationId: open.id });

  const application = await prisma.verificationApplication.create({
    data: { cleanerId: user.id },
  });
  return ok({ application }, { status: 201 });
});
