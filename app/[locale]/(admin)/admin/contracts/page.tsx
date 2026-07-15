'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Select, Textarea, ToastProvider, useToast } from '@/app/components/ui';

// Contract template editor (E7.1, §8). Editing creates a NEW version; the
// lawyer_approved toggle is the compliance switch (audited server-side).
// Preview substitutes sample data into an iframe.

interface Template {
  id: string;
  key: string;
  legalRegime: string;
  lang: string;
  version: number;
  htmlBody: string;
  lawyerApproved: boolean;
}

const SAMPLE: Record<string, string> = {
  bookingCode: 'TT-DEMO-001',
  customerName: 'Lejla Kovač',
  cleanerName: 'Amina Hodžić',
  cleanerJmbg: '0101990•••••',
  jobDescription: 'standardno čišćenje stana 75 m²',
  dates: '20.7.2026. u 10:00',
  compensationKM: '48,00 KM',
  contributionNote: 'Doprinosi se obračunavaju u skladu s važećim propisima.',
  cityDate: 'Sarajevo, 16.7.2026.',
};

function substitute(html: string): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, token: string) => SAMPLE[token] ?? `{{${token}}}`);
}

function ContractsInner() {
  const t = useTranslations('AdminContracts');
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => templates.find((tpl) => tpl.id === selectedId) ?? null,
    [templates, selectedId],
  );

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/contract-templates');
    if (!res.ok) {
      toast.show(t('loadError'), 'error');
      return;
    }
    const { data } = await res.json();
    setTemplates(data.templates);
    if (!selectedId && data.templates.length > 0) setSelectedId(data.templates[0].id);
  }, [selectedId, t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected) setBody(selected.htmlBody);
  }, [selected]);

  const saveNewVersion = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/contract-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: selected.key,
          legalRegime: selected.legalRegime,
          lang: selected.lang,
          htmlBody: body,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.show(t('saveError'), 'error');
        return;
      }
      toast.show(t('saved', { version: json.data.template.version }), 'success');
      setSelectedId(json.data.template.id);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleApproval = async () => {
    if (!selected) return;
    const res = await fetch(`/api/admin/contract-templates/${selected.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: !selected.lawyerApproved }),
    });
    toast.show(res.ok ? t('approvalChanged') : t('saveError'), res.ok ? 'success' : 'error');
    await load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-md">
          <Select label={t('template')} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.key} · {tpl.legalRegime} · {tpl.lang} · v{tpl.version}
                {tpl.lawyerApproved ? ' ✓' : ' (nacrt)'}
              </option>
            ))}
          </Select>
        </div>
        {selected && (
          <Button variant={selected.lawyerApproved ? 'destructive' : 'secondary'} onClick={() => void toggleApproval()}>
            {selected.lawyerApproved ? t('revokeApproval') : t('approve')}
          </Button>
        )}
      </div>

      {selected && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <Textarea
              label={t('editor', { version: selected.version })}
              rows={24}
              className="font-mono text-xs"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="mt-3 flex justify-end">
              <Button onClick={() => void saveNewVersion()} loading={saving} disabled={body === selected.htmlBody}>
                {t('saveNewVersion')}
              </Button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{t('preview')}</p>
            <iframe
              title={t('preview')}
              className="mt-1 h-[560px] w-full rounded-xl border border-gray-200 bg-white"
              srcDoc={`<style>body{font-family:system-ui;padding:24px;color:#111}h1{font-size:20px}h2{font-size:14px}.draft-watermark{border:2px dashed #b45309;color:#b45309;padding:8px;text-align:center;font-weight:700;margin-bottom:16px}</style>${substitute(body)}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminContractsPage() {
  return (
    <ToastProvider>
      <ContractsInner />
    </ToastProvider>
  );
}
