'use client';

import { useState } from 'react';
import { cn } from '@/lib/ui/cn';
import { formatKM } from '@/lib/shared/format';

export interface PriceLine {
  label: string;
  amountF: number; // integer fenings
  muted?: boolean; // discounts / sub-notes
}

// Airbnb-style price display (plan §6, H1/H3): one bold total, expandable to the
// itemized lines. Amounts are integer fenings; formatting via formatKM.
export function PriceBreakdown({
  lines,
  totalF,
  totalLabel = 'Ukupno',
  defaultOpen = false,
}: {
  lines: PriceLine[];
  totalF: number;
  totalLabel?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-base font-bold text-gray-900">{totalLabel}</span>
        <span className="flex items-center gap-2">
          <span className="text-base font-bold text-gray-900">{formatKM(totalF)}</span>
          <span className={cn('text-gray-400 transition-transform', open && 'rotate-180')} aria-hidden>
            ▾
          </span>
        </span>
      </button>
      {open && (
        <dl className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3">
          {lines.map((line, i) => (
            <div key={i} className="flex justify-between text-sm">
              <dt className={cn(line.muted ? 'text-gray-500' : 'text-gray-700')}>{line.label}</dt>
              <dd className={cn(line.muted ? 'text-gray-500' : 'text-gray-900')}>
                {formatKM(line.amountF)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
