'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, ConfirmDialog, Input, Select, ToastProvider, useToast } from '@/app/components/ui';

// Admin user management (E9.4): search, suspend/reactivate (audited),
// impersonate-for-support (opens the token handoff in a new tab so the admin
// keeps their own session in this one).

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'customer' | 'cleaner' | 'admin';
  status: 'active' | 'suspended' | 'deleted';
  isHost: boolean;
  cleanerProfile: { tier: string; active: boolean; hourlyRateF: number | null } | null;
}

function UsersInner() {
  const t = useTranslations('AdminUsers');
  const toast = useToast();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (role) params.set('role', role);
    const res = await fetch(`/api/admin/users?${params}`);
    if (!res.ok) {
      toast.show(t('loadError'), 'error');
      return;
    }
    const { data } = await res.json();
    setUsers(data.users);
    setTotal(data.total);
  }, [q, role, t, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const setStatus = async (user: AdminUser, status: 'active' | 'suspended', why?: string) => {
    const res = await fetch(`/api/admin/users/${user.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...(why ? { reason: why } : {}) }),
    });
    toast.show(res.ok ? t('statusChanged') : t('actionError'), res.ok ? 'success' : 'error');
    await load();
  };

  const impersonate = async (user: AdminUser) => {
    const res = await fetch(`/api/admin/users/${user.id}/impersonate`, { method: 'POST' });
    if (!res.ok) {
      toast.show(t('actionError'), 'error');
      return;
    }
    const { data } = await res.json();
    window.open(`/impersonate?token=${encodeURIComponent(data.token)}`, '_blank');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input label={t('search')} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} />
        </div>
        <div className="w-44">
          <Select label={t('role')} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{t('roleAll')}</option>
            <option value="customer">{t('roleCustomer')}</option>
            <option value="cleaner">{t('roleCleaner')}</option>
            <option value="admin">{t('roleAdmin')}</option>
          </Select>
        </div>
        <p className="pb-2 text-sm text-gray-500">{t('total', { count: total })}</p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">{t('user')}</th>
              <th className="px-4 py-3">{t('role')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">
                  <span className="font-medium text-gray-900">
                    {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                  </span>
                  <span className="block text-xs text-gray-500">{u.email}</span>
                </td>
                <td className="px-4 py-2">
                  {t(`role${u.role.charAt(0).toUpperCase()}${u.role.slice(1)}` as never)}
                  {u.cleanerProfile && (
                    <span className="block text-xs text-gray-500">
                      {u.cleanerProfile.tier === 'verified' ? t('verified') : t('registered')}
                    </span>
                  )}
                  {u.isHost && <span className="block text-xs text-gray-500">Host</span>}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={
                      u.status === 'active'
                        ? 'rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700'
                        : 'rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700'
                    }
                  >
                    {t(`status${u.status.charAt(0).toUpperCase()}${u.status.slice(1)}` as never)}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {u.role !== 'admin' && (
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => void impersonate(u)}>
                        {t('impersonate')}
                      </Button>
                      {u.status === 'active' ? (
                        <Button variant="destructive" size="sm" onClick={() => { setReason(''); setSuspendTarget(u); }}>
                          {t('suspend')}
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => void setStatus(u, 'active')}>
                          {t('reactivate')}
                        </Button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={suspendTarget !== null}
        title={t('suspendTitle', { email: suspendTarget?.email ?? '' })}
        description={t('suspendDescription')}
        confirmLabel={t('suspend')}
        cancelLabel={t('cancel')}
        destructive
        onConfirm={() => {
          if (suspendTarget) void setStatus(suspendTarget, 'suspended', reason || undefined);
          setSuspendTarget(null);
        }}
        onCancel={() => setSuspendTarget(null)}
      >
        <Input label={t('reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
      </ConfirmDialog>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <ToastProvider>
      <UsersInner />
    </ToastProvider>
  );
}
