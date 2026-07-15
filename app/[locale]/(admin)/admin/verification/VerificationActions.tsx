'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Button, Input } from '@/app/components/ui';

// Row actions for the verification queue (E9.3). Each op PATCHes the API and
// refreshes the server-component list.
export function VerificationActions({
  applicationId,
  status,
  idVerified,
}: {
  applicationId: string;
  status: string;
  idVerified: boolean;
}) {
  const t = useTranslations('Admin');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [interviewAt, setInterviewAt] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/verification/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.code ?? 'ERROR');
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
      {status === 'applied' && (
        <>
          <Input
            label={t('verificationInterviewAt')}
            type="datetime-local"
            value={interviewAt}
            onChange={(e) => setInterviewAt(e.target.value)}
            className="w-52"
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !interviewAt}
            onClick={() => void patch({ op: 'schedule', interviewAt, mode: 'video' })}
          >
            {t('verificationSchedule')}
          </Button>
        </>
      )}
      {status === 'interview_scheduled' && (
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void patch({
              op: 'checklist',
              checklist: { id_verified: true, references_checked: true },
            })
          }
        >
          {t('verificationChecklistOk')}
        </Button>
      )}
      {status === 'checklist' && idVerified && (
        <Button size="sm" disabled={busy} onClick={() => void patch({ op: 'approve' })}>
          {t('verificationApprove')}
        </Button>
      )}
      <Input
        label={t('verificationRejectReason')}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-44"
      />
      <Button
        size="sm"
        variant="destructive"
        disabled={busy || reason.trim().length === 0}
        onClick={() => void patch({ op: 'reject', reason: reason.trim() })}
      >
        {t('verificationReject')}
      </Button>
      {error && <p className="w-full text-sm text-error">{error}</p>}
    </div>
  );
}
