'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ConfirmDialog, Input, Select, ToastProvider, useToast } from '@/app/components/ui';
import { formatKM } from '@/lib/shared/format';

// Admin booking management (E9.5): list + filter + the three §8 interventions.

interface Row {
  id: string;
  code: string;
  status: string;
  scheduledAt: string;
  totalF: number;
  paymentMethod: string;
  customer: { email: string; firstName: string | null; lastName: string | null };
  cleaner: { id: string; user: { firstName: string | null; lastName: string | null } } | null;
  serviceType: { key: string; nameBs: string };
}

type Dialog =
  | { kind: 'no_show'; row: Row }
  | { kind: 'refund'; row: Row }
  | { kind: 'reassign'; row: Row }
  | null;

const STATUSES = ['', 'matching', 'accepted', 'on_my_way', 'in_progress', 'pending_completion', 'completed', 'disputed', 'cancelled', 'expired'];

function BookingsInner() {
  const t = useTranslations('AdminBookings');
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [field, setField] = useState(''); // reason / amount / cleaner id, per dialog

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q.trim()) params.set('q', q.trim());
    const res = await fetch(`/api/admin/bookings?${params}`);
    if (!res.ok) {
      toast.show(t('loadError'), 'error');
      return;
    }
    const { data } = await res.json();
    setRows(data.bookings);
    setTotal(data.total);
  }, [status, q, t, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const act = async () => {
    if (!dialog) return;
    const body =
      dialog.kind === 'no_show'
        ? { action: 'no_show', reason: field || '—' }
        : dialog.kind === 'refund'
          ? { action: 'refund', amountF: Math.round(Number(field) * 100), reason: t('manualRefund') }
          : { action: 'reassign', cleanerProfileId: field };
    const res = await fetch(`/api/admin/bookings/${dialog.row.id}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    toast.show(
      res.ok ? t('actionDone') : (json?.error?.code ?? t('actionError')),
      res.ok ? 'success' : 'error',
    );
    setDialog(null);
    setField('');
    await load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Input label={t('search')} value={q} onChange={(e) => setQ(e.target.value)} placeholder="TT-… / email" />
        </div>
        <div className="w-52">
          <Select label={t('status')} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === '' ? t('statusAll') : s}
              </option>
            ))}
          </Select>
        </div>
        <p className="pb-2 text-sm text-gray-500">{t('total', { count: total })}</p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">{t('code')}</th>
              <th className="px-4 py-3">{t('customer')}</th>
              <th className="px-4 py-3">{t('cleaner')}</th>
              <th className="px-4 py-3">{t('scheduled')}</th>
              <th className="px-4 py-3">{t('statusCol')}</th>
              <th className="px-4 py-3 text-right">{t('totalCol')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-4 py-2">{r.customer.email}</td>
                <td className="px-4 py-2">
                  {r.cleaner
                    ? [r.cleaner.user.firstName, r.cleaner.user.lastName].filter(Boolean).join(' ')
                    : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-gray-500">
                  {new Date(r.scheduledAt).toLocaleString('bs-BA', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-4 py-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{r.status}</span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{formatKM(r.totalF)}</td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    {['accepted', 'on_my_way'].includes(r.status) && (
                      <Button variant="ghost" size="sm" onClick={() => { setField(''); setDialog({ kind: 'no_show', row: r }); }}>
                        {t('noShow')}
                      </Button>
                    )}
                    {r.status === 'accepted' && (
                      <Button variant="ghost" size="sm" onClick={() => { setField(''); setDialog({ kind: 'reassign', row: r }); }}>
                        {t('reassign')}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => { setField(''); setDialog({ kind: 'refund', row: r }); }}>
                      {t('refund')}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={dialog !== null}
        title={
          dialog?.kind === 'no_show'
            ? t('noShowTitle', { code: dialog.row.code })
            : dialog?.kind === 'refund'
              ? t('refundTitle', { code: dialog?.row.code ?? '' })
              : t('reassignTitle', { code: dialog?.row.code ?? '' })
        }
        description={dialog?.kind === 'no_show' ? t('noShowDescription') : undefined}
        confirmLabel={t('confirm')}
        cancelLabel={t('cancel')}
        destructive={dialog?.kind === 'no_show'}
        onConfirm={() => void act()}
        onCancel={() => setDialog(null)}
      >
        {dialog?.kind === 'no_show' && (
          <Input label={t('reason')} value={field} onChange={(e) => setField(e.target.value)} />
        )}
        {dialog?.kind === 'refund' && (
          <Input
            label={t('refundAmount')}
            type="number"
            step="0.01"
            min="0.01"
            value={field}
            onChange={(e) => setField(e.target.value)}
            hint={t('refundHint', { total: formatKM(dialog.row.totalF) })}
          />
        )}
        {dialog?.kind === 'reassign' && (
          <Input
            label={t('reassignCleanerId')}
            value={field}
            onChange={(e) => setField(e.target.value)}
            hint={t('reassignHint')}
          />
        )}
      </ConfirmDialog>
    </div>
  );
}

export default function AdminBookingsPage() {
  return (
    <ToastProvider>
      <BookingsInner />
    </ToastProvider>
  );
}
