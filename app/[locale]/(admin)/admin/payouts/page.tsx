'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ConfirmDialog, ToastProvider, useToast } from '@/app/components/ui';
import { formatKM } from '@/lib/shared/format';

// Admin payout runs (E5.5, §7): prepare → export CSV → mark paid.

interface Run {
  id: string;
  weekLabel: string;
  status: 'draft' | 'exported' | 'paid';
  totalsF: number;
  payouts: {
    id: string;
    amountF: number;
    status: string;
    ibanSnapshot: string;
    cleaner: { user: { firstName: string | null; lastName: string | null } };
  }[];
}

function PayoutsInner() {
  const t = useTranslations('AdminPayouts');
  const toast = useToast();
  const [runs, setRuns] = useState<Run[]>([]);
  const [payTarget, setPayTarget] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/payouts');
    if (!res.ok) {
      toast.show(t('loadError'), 'error');
      return;
    }
    setRuns((await res.json()).data.runs);
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const prepare = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json().catch(() => null);
      toast.show(
        res.ok
          ? t('prepared', { count: json.data.run.payouts.length })
          : (json?.error?.code === 'RUN_EXISTS' ? t('runExists') : t('actionError')),
        res.ok ? 'success' : 'error',
      );
      await load();
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    if (!payTarget) return;
    const res = await fetch(`/api/admin/payouts/${payTarget.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_paid' }),
    });
    toast.show(res.ok ? t('paid') : t('actionError'), res.ok ? 'success' : 'error');
    setPayTarget(null);
    await load();
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <Button onClick={() => void prepare()} loading={busy}>
          {t('prepare')}
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {runs.map((run) => (
          <div key={run.id} className="rounded-2xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold tabular-nums">{run.weekLabel}</span>
              <span
                className={
                  run.status === 'paid'
                    ? 'rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700'
                    : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700'
                }
              >
                {t(`status_${run.status}`)}
              </span>
              <span className="tabular-nums text-sm text-gray-600">
                {t('summary', { count: run.payouts.length })} · {formatKM(run.totalsF)}
              </span>
              <span className="ml-auto flex gap-2">
                <a
                  className="text-sm text-primary-500 underline"
                  href={`/api/admin/payouts/${run.id}?format=csv`}
                >
                  {t('exportCsv')}
                </a>
                {run.status === 'exported' && (
                  <Button size="sm" onClick={() => setPayTarget(run)}>
                    {t('markPaid')}
                  </Button>
                )}
              </span>
            </div>
            {run.payouts.length > 0 && (
              <table className="mt-3 w-full text-left text-sm">
                <tbody className="divide-y divide-gray-100">
                  {run.payouts.map((p) => (
                    <tr key={p.id}>
                      <td className="py-1.5">
                        {[p.cleaner.user.firstName, p.cleaner.user.lastName].filter(Boolean).join(' ')}
                      </td>
                      <td className="py-1.5 font-mono text-xs text-gray-500">{p.ibanSnapshot}</td>
                      <td className="py-1.5 text-right tabular-nums">{formatKM(p.amountF)}</td>
                      <td className="py-1.5 pl-3 text-xs text-gray-500">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={payTarget !== null}
        title={t('markPaidTitle', { week: payTarget?.weekLabel ?? '' })}
        description={t('markPaidDescription', { total: formatKM(payTarget?.totalsF ?? 0) })}
        confirmLabel={t('markPaid')}
        cancelLabel={t('cancel')}
        onConfirm={() => void markPaid()}
        onCancel={() => setPayTarget(null)}
      />
    </div>
  );
}

export default function AdminPayoutsPage() {
  return (
    <ToastProvider>
      <PayoutsInner />
    </ToastProvider>
  );
}
