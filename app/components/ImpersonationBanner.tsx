'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

// E9.4: persistent banner while a support session is impersonated — §8 demands
// the state is always visible. Self-contained (fetches /api/auth/me) so the
// static locale layout stays static.
export function ImpersonationBanner() {
  const t = useTranslations('Impersonation');
  const [impersonatedBy, setImpersonatedBy] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setImpersonatedBy(j?.data?.session?.impersonatedBy ?? null))
      .catch(() => {});
  }, []);

  if (!impersonatedBy) return null;

  const exit = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' });
    window.location.href = '/';
  };

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-white">
      <span>{t('banner')}</span>
      <button type="button" onClick={() => void exit()} className="underline underline-offset-2">
        {t('exit')}
      </button>
    </div>
  );
}
