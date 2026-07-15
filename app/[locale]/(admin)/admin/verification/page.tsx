import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/server/db';
import { requireRole } from '@/lib/server/auth/session';
import { VerificationActions } from './VerificationActions';

export const dynamic = 'force-dynamic';

// Verification pipeline queue (E9.3, §8): applied → interview → checklist →
// approve/reject. Row actions call PATCH /api/admin/verification/:id.
export default async function VerificationQueuePage() {
  await requireRole('admin');
  const t = await getTranslations('Admin');

  const applications = await prisma.verificationApplication.findMany({
    where: { status: { in: ['applied', 'interview_scheduled', 'checklist'] } },
    orderBy: { createdAt: 'asc' },
    include: {
      cleaner: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          cleanerLegalProfile: { select: { legalRegime: true } },
        },
      },
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{t('verificationTitle')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('verificationCount', { count: applications.length })}</p>

      {applications.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          {t('verificationEmpty')}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {applications.map((app) => (
            <div key={app.id} className="rounded-2xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">
                    {[app.cleaner.firstName, app.cleaner.lastName].filter(Boolean).join(' ') ||
                      app.cleaner.email}
                  </p>
                  <p className="text-sm text-gray-500">
                    {app.cleaner.email} · {app.cleaner.cleanerLegalProfile?.legalRegime ?? '—'} ·{' '}
                    {t(`verificationStatus_${app.status}`)}
                    {app.interviewAt &&
                      ` · ${app.interviewAt.toISOString().replace('T', ' ').slice(0, 16)}`}
                  </p>
                </div>
                <VerificationActions
                  applicationId={app.id}
                  status={app.status}
                  idVerified={Boolean((app.checklist as { id_verified?: boolean } | null)?.id_verified)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
