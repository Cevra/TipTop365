'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/ui/cn';

// Offer-expiry countdown (plan H5). Ticks down to `expiresAt`; turns red under
// the warning threshold; fires onExpire once when it hits zero.
export function CountdownPill({
  expiresAt,
  warnUnderSec = 30,
  onExpire,
}: {
  expiresAt: number; // epoch ms
  warnUnderSec?: number;
  onExpire?: () => void;
}) {
  const [remainingMs, setRemainingMs] = useState(() => expiresAt - Date.now());

  useEffect(() => {
    const tick = () => setRemainingMs(expiresAt - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (remainingMs <= 0) onExpire?.();
  }, [remainingMs, onExpire]);

  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const ss = (totalSec % 60).toString().padStart(2, '0');
  const warn = totalSec <= warnUnderSec;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums',
        warn ? 'bg-status-alert/10 text-status-alert' : 'bg-status-matching/10 text-status-matching',
      )}
      role="timer"
      aria-live={warn ? 'assertive' : 'off'}
    >
      ⏱ {mm}:{ss}
    </span>
  );
}
