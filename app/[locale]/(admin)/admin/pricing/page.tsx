'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ConfirmDialog, Input, Select, Textarea, ToastProvider, useToast } from '@/app/components/ui';
import { formatKM } from '@/lib/shared/format';

// Admin pricing editor (E2.3, §5 "no hardcoding"). Versioned: editing always
// creates a NEW draft; publishing atomically activates exactly one version per
// city. Scalars get typed fields; the three jsonb structures are edited as
// JSON (internal tool — the server re-validates through the same parser the
// quote engine uses, so nothing malformed can be saved, let alone published).

interface Version {
  id: string;
  version: number;
  active: boolean;
  rateMinF: number;
  rateMaxF: number;
  platformFeePct: number;
  cashFeeF: number | null;
  negativeBalanceLimitF: number;
  autoConfirmHours: number;
  minAfterPhotosPerRoom: number;
  m2Bands: unknown;
  recurringDiscountPct: unknown;
  cancellationRules: unknown;
  createdAt: string;
}

function PricingAdminInner() {
  const t = useTranslations('AdminPricing');
  const toast = useToast();

  const [citySlug, setCitySlug] = useState('sarajevo');
  const [cities, setCities] = useState<{ slug: string; name: string }[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [publishTarget, setPublishTarget] = useState<Version | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    rateMinKM: '8',
    rateMaxKM: '15',
    platformFeePct: '20',
    cashFeeKM: '2',
    negativeBalanceLimitKM: '-50',
    autoConfirmHours: '48',
    minAfterPhotosPerRoom: '2',
    m2Bands: '',
    recurringDiscountPct: '',
    cancellationRules: '',
  });

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/pricing?city=${citySlug}`);
    if (!res.ok) {
      toast.show(t('loadError'), 'error');
      return;
    }
    const { data } = await res.json();
    setVersions(data.versions);
  }, [citySlug, t, toast]);

  useEffect(() => {
    fetch('/api/catalog?city=sarajevo')
      .then((r) => r.json())
      .then((j) => setCities(j?.data ? [{ slug: 'sarajevo', name: 'Sarajevo' }, { slug: 'banja-luka', name: 'Banja Luka' }] : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDraftFrom = (v: Version) => {
    setForm({
      rateMinKM: (v.rateMinF / 100).toString(),
      rateMaxKM: (v.rateMaxF / 100).toString(),
      platformFeePct: v.platformFeePct.toString(),
      cashFeeKM: v.cashFeeF === null ? '' : (v.cashFeeF / 100).toString(),
      negativeBalanceLimitKM: (v.negativeBalanceLimitF / 100).toString(),
      autoConfirmHours: v.autoConfirmHours.toString(),
      minAfterPhotosPerRoom: v.minAfterPhotosPerRoom.toString(),
      m2Bands: JSON.stringify(v.m2Bands, null, 2),
      recurringDiscountPct: JSON.stringify(v.recurringDiscountPct, null, 2),
      cancellationRules: JSON.stringify(v.cancellationRules, null, 2),
    });
    setDraftOpen(true);
  };

  const saveDraft = async () => {
    let m2Bands: unknown, discounts: unknown, rules: unknown;
    try {
      m2Bands = JSON.parse(form.m2Bands);
      discounts = JSON.parse(form.recurringDiscountPct);
      rules = JSON.parse(form.cancellationRules);
    } catch {
      toast.show(t('jsonError'), 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citySlug,
          m2Bands,
          recurringDiscountPct: discounts,
          cancellationRules: rules,
          rateMinF: Math.round(Number(form.rateMinKM) * 100),
          rateMaxF: Math.round(Number(form.rateMaxKM) * 100),
          platformFeePct: Number(form.platformFeePct),
          cashFeeF: form.cashFeeKM.trim() === '' ? null : Math.round(Number(form.cashFeeKM) * 100),
          negativeBalanceLimitF: Math.round(Number(form.negativeBalanceLimitKM) * 100),
          autoConfirmHours: Number(form.autoConfirmHours),
          minAfterPhotosPerRoom: Number(form.minAfterPhotosPerRoom),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.show(json?.error?.details?.reason ?? t('saveError'), 'error');
        return;
      }
      toast.show(t('draftSaved', { version: json.data.draft.version }), 'success');
      setDraftOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!publishTarget) return;
    const res = await fetch(`/api/admin/pricing/${publishTarget.id}/publish`, { method: 'POST' });
    toast.show(res.ok ? t('published', { version: publishTarget.version }) : t('publishError'), res.ok ? 'success' : 'error');
    setPublishTarget(null);
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <div className="w-48">
          <Select value={citySlug} onChange={(e) => setCitySlug(e.target.value)} aria-label={t('city')}>
            {(cities.length ? cities : [{ slug: 'sarajevo', name: 'Sarajevo' }]).map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">{t('version')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('rates')}</th>
              <th className="px-4 py-3">{t('fee')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {versions.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-2 font-medium tabular-nums">v{v.version}</td>
                <td className="px-4 py-2">
                  {v.active ? (
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">
                      {t('active')}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">{t('draft')}</span>
                  )}
                </td>
                <td className="px-4 py-2 tabular-nums">
                  {formatKM(v.rateMinF)}–{formatKM(v.rateMaxF)}/h
                </td>
                <td className="px-4 py-2 tabular-nums">{v.platformFeePct} %</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openDraftFrom(v)}>
                      {t('newDraftFrom')}
                    </Button>
                    {!v.active && (
                      <Button variant="secondary" size="sm" onClick={() => setPublishTarget(v)}>
                        {t('publish')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draftOpen && (
        <form
          className="mt-6 flex flex-col gap-4 rounded-2xl border border-gray-200 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveDraft();
          }}
        >
          <h2 className="text-lg font-semibold">{t('draftTitle')}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Input label={t('rateMin')} type="number" step="0.01" value={form.rateMinKM} onChange={(e) => setForm({ ...form, rateMinKM: e.target.value })} required />
            <Input label={t('rateMax')} type="number" step="0.01" value={form.rateMaxKM} onChange={(e) => setForm({ ...form, rateMaxKM: e.target.value })} required />
            <Input label={t('feePct')} type="number" step="0.5" value={form.platformFeePct} onChange={(e) => setForm({ ...form, platformFeePct: e.target.value })} required />
            <Input label={t('cashFee')} type="number" step="0.01" value={form.cashFeeKM} onChange={(e) => setForm({ ...form, cashFeeKM: e.target.value })} />
            <Input label={t('negLimit')} type="number" step="0.01" value={form.negativeBalanceLimitKM} onChange={(e) => setForm({ ...form, negativeBalanceLimitKM: e.target.value })} required />
            <Input label={t('autoConfirm')} type="number" value={form.autoConfirmHours} onChange={(e) => setForm({ ...form, autoConfirmHours: e.target.value })} required />
            <Input label={t('minPhotos')} type="number" value={form.minAfterPhotosPerRoom} onChange={(e) => setForm({ ...form, minAfterPhotosPerRoom: e.target.value })} required />
          </div>
          <Textarea label={t('bands')} rows={6} className="font-mono text-xs" value={form.m2Bands} onChange={(e) => setForm({ ...form, m2Bands: e.target.value })} />
          <Textarea label={t('discounts')} rows={3} className="font-mono text-xs" value={form.recurringDiscountPct} onChange={(e) => setForm({ ...form, recurringDiscountPct: e.target.value })} />
          <Textarea label={t('rules')} rows={4} className="font-mono text-xs" value={form.cancellationRules} onChange={(e) => setForm({ ...form, cancellationRules: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDraftOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              {t('saveDraft')}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={publishTarget !== null}
        title={t('publishTitle', { version: publishTarget?.version ?? 0 })}
        description={t('publishDescription')}
        confirmLabel={t('publish')}
        cancelLabel={t('cancel')}
        onConfirm={() => void publish()}
        onCancel={() => setPublishTarget(null)}
      />
    </div>
  );
}

export default function PricingAdminPage() {
  return (
    <ToastProvider>
      <PricingAdminInner />
    </ToastProvider>
  );
}
