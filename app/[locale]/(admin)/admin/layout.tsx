import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireRole } from '@/lib/server/auth/session';

// Admin shell (E9.1, plan §10.7): desktop-first back office. Role-gated
// server-side on EVERY request (the middleware prefix check is only the
// cheap cookie-presence gate). Module pages land in their E9.x tasks — nav
// entries exist from day one so the information architecture is stable.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole('admin');
  const t = await getTranslations('Admin');

  const nav: { href: string; label: string; ready: boolean }[] = [
    { href: '/admin', label: t('navDashboard'), ready: true },
    { href: '/admin/audit', label: t('navAudit'), ready: true },
    { href: '/admin/verification', label: t('navVerification'), ready: true },
    { href: '/admin/users', label: t('navUsers'), ready: true },
    { href: '/admin/bookings', label: t('navBookings'), ready: true },
    { href: '/admin/payouts', label: t('navPayouts'), ready: true },
    { href: '/admin/pricing', label: t('navPricing'), ready: true },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 px-6 py-8">
      <aside className="w-48 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">TipTop365</p>
        <h2 className="text-lg font-bold text-primary-500">{t('title')}</h2>
        <nav className="mt-4 flex flex-col gap-1">
          {nav.map((item) =>
            item.ready ? (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.href}
                className="cursor-not-allowed rounded-lg px-3 py-2 text-sm text-gray-300"
                title={t('comingSoon')}
              >
                {item.label}
              </span>
            ),
          )}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
