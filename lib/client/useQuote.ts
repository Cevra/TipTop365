'use client';

import { useEffect, useRef, useState } from 'react';
import type { PricingSnapshot } from '@/lib/domain/pricing';

// Debounced live-quote hook (E2.2): POSTs the wizard's current selection to
// /api/pricing/quote whenever it changes. Server-computed only — this hook
// never does money math (§6).

export interface QuoteParams {
  citySlug: string;
  serviceTypeKey: string;
  m2: number;
  addons: { key: string; qty: number }[];
  paymentMethod: 'card' | 'cash';
  recurring?: 'weekly' | 'biweekly' | 'monthly';
  rateF?: number;
}

export type QuoteResult =
  | { kind: 'exact'; quote: PricingSnapshot }
  | { kind: 'range'; min: PricingSnapshot; max: PricingSnapshot };

const DEBOUNCE_MS = 300;

export function useQuote(params: QuoteParams | null): {
  quote: QuoteResult | null;
  loading: boolean;
  error: string | null;
} {
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const key = params ? JSON.stringify(params) : null;

  useEffect(() => {
    if (!key) {
      setQuote(null);
      return;
    }
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch('/api/pricing/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: key,
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json?.error?.code ?? 'UNKNOWN');
          setQuote(null);
        } else {
          setQuote(json.data as QuoteResult);
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('NETWORK');
          setQuote(null);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [key]);

  return { quote, loading, error };
}
