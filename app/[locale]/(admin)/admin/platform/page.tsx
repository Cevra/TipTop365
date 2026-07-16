'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Input, Select, Textarea, ToastProvider, useToast } from '@/app/components/ui';
import { formatKM } from '@/lib/shared/format';

// Platform admin (E9.6): cities, feature flags, promo codes, campaign blast.
// Campaigns enqueue D10 outbox rows; E10.1's dispatcher delivers them.

interface City { id: string; name: string; slug: string; active: boolean; launchStage: string | null; _count: { cleanerProfiles: number; properties: number } }
interface Flag { key: string; description: string; default: boolean; dbValue: boolean | null; envOverride: string | null }
interface Promo { id: string; code: string; type: 'pct' | 'fixed'; value: number; active: boolean; validUntil: string | null; _count: { redemptions: number } }

function PlatformInner() {
  const t = useTranslations('AdminPlatform');
  const toast = useToast();
  const [cities, setCities] = useState<City[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [cityName, setCityName] = useState('');
  const [promoForm, setPromoForm] = useState({ code: '', type: 'pct' as 'pct' | 'fixed', value: '10' });
  const [campaign, setCampaign] = useState({ audience: 'all', channel: 'push', title: '', body: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, f, p] = await Promise.all([
      fetch('/api/admin/cities').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/admin/flags').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/admin/promos').then((r) => (r.ok ? r.json() : null)),
    ]);
    if (c) setCities(c.data.cities);
    if (f) setFlags(f.data.flags);
    if (p) setPromos(p.data.promos);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const call = async (url: string, method: string, body: unknown, okMsg: string) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    toast.show(res.ok ? okMsg : (json?.error?.code ?? t('actionError')), res.ok ? 'success' : 'error');
    await load();
    return res.ok;
  };

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>

      {/* Cities */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900">{t('cities')}</h2>
        <div className="mt-2 flex flex-col gap-2">
          {cities.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-2 text-sm">
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-gray-500">{c._count.cleanerProfiles} {t('cleanersShort')} · {c._count.properties} {t('propertiesShort')}</span>
              <span className="ml-auto">
                <Button variant="ghost" size="sm" onClick={() => void call('/api/admin/cities', 'PATCH', { id: c.id, active: !c.active }, t('saved'))}>
                  {c.active ? t('deactivate') : t('activate')}
                </Button>
              </span>
            </div>
          ))}
        </div>
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (cityName.trim()) void call('/api/admin/cities', 'POST', { name: cityName.trim() }, t('saved')).then((okay) => okay && setCityName(''));
          }}
        >
          <div className="w-64">
            <Input label={t('newCity')} value={cityName} onChange={(e) => setCityName(e.target.value)} placeholder="Mostar" />
          </div>
          <Button type="submit" variant="secondary">{t('add')}</Button>
        </form>
      </section>

      {/* Flags */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900">{t('flags')}</h2>
        <div className="mt-2 flex flex-col gap-2">
          {flags.map((f) => {
            const effective = f.envOverride !== null ? f.envOverride === 'true' : (f.dbValue ?? f.default);
            return (
              <div key={f.key} className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-2 text-sm">
                <span>
                  <code className="font-mono text-xs">{f.key}</code>
                  <span className="block text-xs text-gray-500">{f.description}</span>
                </span>
                {f.envOverride !== null && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{t('envOverride', { value: f.envOverride })}</span>
                )}
                <span className="ml-auto">
                  <Button
                    variant={effective ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => void call('/api/admin/flags', 'POST', { key: f.key, enabled: !(f.dbValue ?? f.default) }, t('saved'))}
                  >
                    {effective ? t('turnOff') : t('turnOn')}
                  </Button>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Promos */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900">{t('promos')}</h2>
        <div className="mt-2 flex flex-col gap-2">
          {promos.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-2 text-sm">
              <code className="font-mono">{p.code}</code>
              <span className="text-xs text-gray-500">
                {p.type === 'pct' ? `−${p.value} %` : `−${formatKM(p.value)}`} · {p._count.redemptions} {t('redemptions')}
              </span>
              {!p.active && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{t('inactive')}</span>}
              <span className="ml-auto">
                <Button variant="ghost" size="sm" onClick={() => void call('/api/admin/promos', 'PATCH', { id: p.id, active: !p.active }, t('saved'))}>
                  {p.active ? t('deactivate') : t('activate')}
                </Button>
              </span>
            </div>
          ))}
        </div>
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void call(
              '/api/admin/promos',
              'POST',
              { code: promoForm.code.toUpperCase(), type: promoForm.type, value: Number(promoForm.value) * (promoForm.type === 'fixed' ? 100 : 1) },
              t('saved'),
            ).then((okay) => okay && setPromoForm({ code: '', type: 'pct', value: '10' }));
          }}
        >
          <div className="w-44"><Input label={t('promoCode')} value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value })} /></div>
          <div className="w-36">
            <Select label={t('promoType')} value={promoForm.type} onChange={(e) => setPromoForm({ ...promoForm, type: e.target.value as 'pct' | 'fixed' })}>
              <option value="pct">%</option>
              <option value="fixed">KM</option>
            </Select>
          </div>
          <div className="w-28"><Input label={t('promoValue')} type="number" min="1" value={promoForm.value} onChange={(e) => setPromoForm({ ...promoForm, value: e.target.value })} /></div>
          <Button type="submit" variant="secondary">{t('add')}</Button>
        </form>
      </section>

      {/* Campaign */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900">{t('campaign')}</h2>
        <p className="mt-1 text-xs text-gray-500">{t('campaignHint')}</p>
        <form
          className="mt-2 flex max-w-xl flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            void call('/api/admin/campaigns', 'POST', campaign, t('campaignQueued')).finally(() => setBusy(false));
          }}
        >
          <div className="flex gap-3">
            <div className="w-44">
              <Select label={t('audience')} value={campaign.audience} onChange={(e) => setCampaign({ ...campaign, audience: e.target.value })}>
                <option value="all">{t('audienceAll')}</option>
                <option value="customers">{t('audienceCustomers')}</option>
                <option value="cleaners">{t('audienceCleaners')}</option>
                <option value="hosts">{t('audienceHosts')}</option>
              </Select>
            </div>
            <div className="w-36">
              <Select label={t('channel')} value={campaign.channel} onChange={(e) => setCampaign({ ...campaign, channel: e.target.value })}>
                <option value="push">Push</option>
                <option value="email">Email</option>
              </Select>
            </div>
          </div>
          <Input label={t('campaignTitle')} value={campaign.title} onChange={(e) => setCampaign({ ...campaign, title: e.target.value })} required />
          <Textarea label={t('campaignBody')} value={campaign.body} onChange={(e) => setCampaign({ ...campaign, body: e.target.value })} required />
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>{t('campaignSend')}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function AdminPlatformPage() {
  return (
    <ToastProvider>
      <PlatformInner />
    </ToastProvider>
  );
}
