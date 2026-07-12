'use client';

import { useEffect, useRef, useState } from 'react';
import {
  resolvePollInterval,
  type LiveSnapshot,
} from '@/lib/shared/realtime';

interface Options {
  /** Base poll cadence in ms (default 4000; use POLL_INTERVAL_MAP_MS for maps). */
  intervalMs?: number;
  /** Set false to stop polling (e.g. booking no longer active). */
  enabled?: boolean;
}

/**
 * RealtimeChannel adapter (plan D3 v1.1): polls GET /bookings/:id/live and
 * exposes the latest snapshot. Pauses while the tab is hidden and resumes on
 * focus. The single seam through which the app consumes realtime — swapping in
 * SSE/WebSocket later means reimplementing only this hook.
 */
export function useLiveChannel(bookingId: string | null, options: Options = {}) {
  const { intervalMs = 4000, enabled = true } = options;
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const cursorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !bookingId) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const tick = async () => {
      try {
        const qs = cursorRef.current ? `?cursor=${encodeURIComponent(cursorRef.current)}` : '';
        const res = await fetch(`/api/bookings/${bookingId}/live${qs}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`live channel ${res.status}`);
        const { data } = (await res.json()) as { data: LiveSnapshot };
        if (cancelled) return;
        cursorRef.current = data.cursor;
        setSnapshot(data);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) {
          const delay = resolvePollInterval(
            intervalMs,
            typeof document === 'undefined' ? true : !document.hidden,
          );
          // delay === null means paused (tab hidden); the visibilitychange
          // handler restarts the loop when the tab becomes visible again.
          if (delay !== null) timer = setTimeout(tick, delay);
        }
      }
    };

    const onVisibility = () => {
      if (!document.hidden && timer === undefined) tick();
    };

    tick();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [bookingId, intervalMs, enabled]);

  return { snapshot, error };
}
