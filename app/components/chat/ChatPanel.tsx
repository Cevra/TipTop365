'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/components/ui';
import {
  POLL_INTERVAL_CHAT_MS,
  resolvePollInterval,
  type LiveMessage,
} from '@/lib/shared/realtime';

// Booking chat panel (E4.5) — polls /live (D3), sends via /chat. Layout-
// independent so H4 (booking detail) can slot it in after design approval.
export function ChatPanel({ bookingId, selfUserId }: { bookingId: string; selfUserId: string }) {
  const t = useTranslations('Chat');
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    const qs = cursorRef.current ? `?cursor=${encodeURIComponent(cursorRef.current)}` : '';
    const res = await fetch(`/api/bookings/${bookingId}/live${qs}`);
    if (!res.ok) return;
    const { data } = await res.json();
    if (data.messages.length > 0) {
      cursorRef.current = data.cursor;
      setMessages((prev) => [...prev, ...data.messages]);
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    }
  }, [bookingId]);

  useEffect(() => {
    void poll();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const interval = resolvePollInterval(POLL_INTERVAL_CHAT_MS, document.visibilityState === 'visible');
      timer = setTimeout(async () => {
        if (interval !== null) await poll();
        tick();
      }, interval ?? POLL_INTERVAL_CHAT_MS);
    };
    tick();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [poll]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice(json?.error?.code === 'CHAT_CLOSED' ? t('closed') : t('sendError'));
        return;
      }
      if (json.data.wasMasked) setNotice(t('maskedNotice'));
      setDraft('');
      await poll();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-96 flex-col rounded-2xl border border-gray-200">
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && <p className="text-center text-sm text-gray-400">{t('empty')}</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              m.senderId === selfUserId
                ? 'ml-auto bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            {m.body}
          </div>
        ))}
      </div>
      {notice && <p className="border-t border-gray-100 px-3 py-2 text-xs text-amber-700">{notice}</p>}
      <form
        className="flex gap-2 border-t border-gray-200 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('placeholder')}
          maxLength={2000}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <Button type="submit" loading={sending} disabled={!draft.trim()}>
          {t('send')}
        </Button>
      </form>
    </div>
  );
}
