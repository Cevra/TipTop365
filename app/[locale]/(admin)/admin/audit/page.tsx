import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/server/db';
import { requireRole } from '@/lib/server/auth/session';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

// Audit-log browser (E9.1): read-only table over audit_log, newest first.
// Filters/search grow with the modules that write richer entries (E9.4+).
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  await requireRole('admin');
  const t = await getTranslations('Admin');

  const page = Math.max(1, Number(searchParams.page) || 1);
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { email: true } } },
    }),
    prisma.auditLog.count(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{t('auditTitle')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('auditCount', { count: total })}</p>

      {entries.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          {t('auditEmpty')}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">{t('auditWhen')}</th>
                <th className="px-4 py-3">{t('auditActor')}</th>
                <th className="px-4 py-3">{t('auditAction')}</th>
                <th className="px-4 py-3">{t('auditEntity')}</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums text-gray-500">
                    {entry.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="px-4 py-2">{entry.actor?.email ?? t('auditSystem')}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{entry.action}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {entry.entityType}/{entry.entityId}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{entry.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex gap-2 text-sm">
          {page > 1 && (
            <a className="text-primary-500 underline" href={`?page=${page - 1}`}>
              ‹ {t('auditPrev')}
            </a>
          )}
          <span className="text-gray-500">
            {page} / {pages}
          </span>
          {page < pages && (
            <a className="text-primary-500 underline" href={`?page=${page + 1}`}>
              {t('auditNext')} ›
            </a>
          )}
        </div>
      )}
    </div>
  );
}
