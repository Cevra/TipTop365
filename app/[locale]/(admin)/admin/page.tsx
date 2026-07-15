import { getTranslations } from 'next-intl/server';
import { requireRole } from '@/lib/server/auth/session';
import { dashboardMetrics } from '@/lib/server/adminMetrics';
import { formatKM } from '@/lib/shared/format';

export const dynamic = 'force-dynamic';

// Admin dashboard (E9.2, §8): the five numbers the plan names, 30-day window.
export default async function AdminDashboard() {
  await requireRole('admin');
  const t = await getTranslations('AdminDashboard');
  const m = await dashboardMetrics(30);

  const tiles: { label: string; value: string; sub?: string }[] = [
    { label: t('bookings'), value: String(m.bookingsCreated), sub: t('bookingsSub', { open: m.bookingsOpen, cancelled: m.bookingsCancelled }) },
    { label: t('gmv'), value: formatKM(m.gmvF), sub: t('completedCount', { count: m.bookingsCompleted }) },
    { label: t('commission'), value: formatKM(m.commissionF) },
    {
      label: t('conversion'),
      value: m.conversionPct === null ? '—' : `${m.conversionPct} %`,
      sub: t('conversionSub'),
    },
    { label: t('cleaners'), value: String(m.activeCleaners), sub: t('cleanersSub', { verified: m.verifiedCleaners }) },
    { label: t('disputes'), value: String(m.disputesOpen) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('window')}</p>
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-gray-200 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{tile.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{tile.value}</p>
            {tile.sub && <p className="mt-1 text-xs text-gray-500">{tile.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
