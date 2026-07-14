'use client';

import { useTranslations } from 'next-intl';
import { PriceBreakdown, type PriceLine } from '@/app/components/ui';
import { formatKM } from '@/lib/shared/format';
import type { PricingSnapshot } from '@/lib/domain/pricing';
import type { QuoteResult } from '@/lib/client/useQuote';

// Airbnb-style quote display (E2.2, §6/G2): one clear total, expandable
// breakdown. Exact quote (cleaner chosen) → PriceBreakdown; range quote
// (pre-selection) → "od X do Y KM" summary. All money comes from the server
// snapshot — this component only formats.

type Translate = (key: string, values?: Record<string, string | number>) => string;

function linesFor(quote: PricingSnapshot, t: Translate): PriceLine[] {
  const lines: PriceLine[] = [
    {
      label: t('cleaning', { hours: quote.estHours, rate: formatKM(quote.rateF) }),
      amountF: quote.cleanerAmountF,
    },
  ];
  if (quote.discountF > 0) {
    lines.push({
      label: t('recurringDiscount', { pct: quote.discountPct }),
      amountF: -quote.discountF,
      muted: true,
    });
  }
  lines.push({ label: t('serviceFee'), amountF: quote.serviceFeeF });
  if (quote.cashFeeF > 0) {
    lines.push({ label: t('cashFee'), amountF: quote.cashFeeF });
  }
  return lines;
}

export function QuoteBreakdown({ result }: { result: QuoteResult }) {
  const t = useTranslations('Quote');

  if (result.kind === 'exact') {
    return (
      <PriceBreakdown
        lines={linesFor(result.quote, t)}
        totalF={result.quote.totalF}
        totalLabel={t('total')}
        defaultOpen
      />
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-gray-900">{t('estimatedTotal')}</span>
        <span className="text-base font-bold text-gray-900">
          {t('range', { min: formatKM(result.min.totalF), max: formatKM(result.max.totalF) })}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-500">{t('rangeHint', { hours: result.min.estHours })}</p>
    </div>
  );
}
