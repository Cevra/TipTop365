'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button, EmptyState, Stepper, ToastProvider, useToast } from '@/app/components/ui';
import { useQuote } from '@/lib/client/useQuote';
import { formatKM } from '@/lib/shared/format';

// Booking wizard steps 1–3 (E3.2, plan §11 / blueprint H1) — rebuilt over the
// legacy Firestore form per the approved prototype (v2 feedback: back button
// in the header, overflow-safe sticky total). Steps 4–5 (cleaner select H2,
// photos) arrive with E3.6/E3.7; the wizard ends by creating the draft
// booking server-side (POST /api/bookings — server reprices, client displays).

interface Property {
  id: string;
  label: string | null;
  street: string | null;
  houseNo: string | null;
  sizeM2: number | null;
  isAirbnb: boolean;
  city: { slug: string; name: string } | null;
}
interface CatalogService {
  key: string;
  nameBs: string;
  nameEn: string;
  durationMultiplier: number;
  requiresVerified: boolean;
}
interface CatalogAddon {
  key: string;
  nameBs: string;
  nameEn: string;
  hours: number;
  unit: 'fixed' | 'per_window' | 'per_hour' | 'per_m2';
}

const SLOT_TIMES = ['08:00', '10:00', '12:00', '14:00', '16:00'];
const RECURRING = [null, 'weekly', 'biweekly', 'monthly'] as const;

function WizardInner() {
  const t = useTranslations('Wizard');
  const locale = useLocale();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [addons, setAddons] = useState<CatalogAddon[]>([]);
  const [discounts, setDiscounts] = useState<Record<string, number>>({});

  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [serviceKey, setServiceKey] = useState<string>('standard');
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [dayOffset, setDayOffset] = useState(1);
  const [slot, setSlot] = useState('10:00');
  const [recurring, setRecurring] = useState<(typeof RECURRING)[number]>(null);
  const [paymentMethod] = useState<'card' | 'cash'>('card'); // method picker = H3 (summary step)
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const property = properties?.find((p) => p.id === propertyId) ?? null;
  const name = (x: { nameBs: string; nameEn: string }) => (locale === 'en' ? x.nameEn : x.nameBs);

  useEffect(() => {
    void Promise.all([
      fetch('/api/properties').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/catalog?city=sarajevo').then((r) => (r.ok ? r.json() : null)),
    ]).then(([props, catalog]) => {
      const list: Property[] = props?.data?.properties ?? [];
      setProperties(list);
      if (list.length > 0) setPropertyId((id) => id ?? list[0].id);
      if (catalog?.data) {
        setServices(catalog.data.services);
        setAddons(catalog.data.addons);
        setDiscounts(catalog.data.pricing.recurringDiscountPct ?? {});
      }
    });
  }, []);

  const quoteParams = useMemo(() => {
    if (!property?.city || !property.sizeM2) return null;
    return {
      citySlug: property.city.slug,
      serviceTypeKey: serviceKey,
      m2: property.sizeM2,
      addons: Object.entries(addonQty)
        .filter(([, qty]) => qty > 0)
        .map(([key, qty]) => ({ key, qty })),
      paymentMethod,
      recurring: recurring ?? undefined,
    };
  }, [property, serviceKey, addonQty, paymentMethod, recurring]);

  const { quote } = useQuote(quoteParams);

  const scheduledAt = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    const [h, m] = slot.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }, [dayOffset, slot]);

  const submit = async () => {
    if (!propertyId) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          serviceTypeKey: serviceKey,
          addons: quoteParams?.addons ?? [],
          scheduledAt: scheduledAt.toISOString(),
          paymentMethod,
          recurring: recurring ?? undefined,
        }),
      });
      if (!res.ok) {
        toast.show(t('submitError'), 'error');
        return;
      }
      const json = await res.json();
      setCreatedCode(json.data.booking.code);
    } finally {
      setSubmitting(false);
    }
  };

  if (createdCode) {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-12">
        <EmptyState
          title={t('createdTitle', { code: createdCode })}
          description={t('createdDescription')}
          action={
            <Link href="/properties">
              <Button variant="secondary">{t('createdBack')}</Button>
            </Link>
          }
        />
      </main>
    );
  }

  const dayChips = Array.from({ length: 10 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + 1 + i);
    return { offset: i + 1, label: `${d.getDate()}.${d.getMonth() + 1}.` };
  });

  const canNext =
    step === 1 ? Boolean(property?.sizeM2 && property.city) : step === 2 ? Boolean(serviceKey) : true;

  return (
    <main className="mx-auto w-full max-w-lg px-4 pb-36 pt-4">
      {/* Back lives in the header row — prototype v2 feedback */}
      <div className="flex items-center gap-2">
        {step > 1 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="shrink-0 py-2 pr-2 text-sm text-gray-500"
          >
            ‹ {t('back')}
          </button>
        )}
        <p className="truncate text-xs font-medium uppercase tracking-wide text-gray-500">
          {t('stepLabel', { step, total: 3 })}
        </p>
      </div>
      <div className="mt-2">
        <Stepper steps={[t('step1Title'), t('step2Title'), t('step3Title')]} current={step - 1} />
      </div>

      {step === 1 && (
        <section className="mt-4">
          <h1 className="text-2xl font-bold text-gray-900">{t('step1Heading')}</h1>
          <div className="mt-4 flex flex-col gap-3">
            {properties === null ? (
              <div className="animate-pulse rounded-2xl border border-gray-200 p-6 text-sm text-gray-400">
                {t('loading')}
              </div>
            ) : properties.length === 0 ? (
              <EmptyState
                title={t('noProperties')}
                description={t('noPropertiesHint')}
                action={
                  <Link href="/properties">
                    <Button>{t('addProperty')}</Button>
                  </Link>
                }
              />
            ) : (
              properties.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={p.id === propertyId}
                  onClick={() => setPropertyId(p.id)}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${
                    p.id === propertyId ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">
                      {p.label || [p.street, p.houseNo].filter(Boolean).join(' ') || t('unnamedProperty')}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {p.sizeM2 ? `${p.sizeM2} m²` : t('missingSize')}
                      {p.city ? ` · ${p.city.name}` : ` · ${t('missingCity')}`}
                    </span>
                  </span>
                  {p.isAirbnb && (
                    <span className="ml-auto shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                      Airbnb
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
          {property && (!property.sizeM2 || !property.city) && (
            <p className="mt-3 text-sm text-error">{t('propertyIncomplete')}</p>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="mt-4">
          <h1 className="text-2xl font-bold text-gray-900">{t('step2Heading')}</h1>
          <div className="mt-4 flex flex-col gap-3">
            {services.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={s.key === serviceKey}
                onClick={() => setServiceKey(s.key)}
                className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-colors ${
                  s.key === serviceKey ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">{name(s)}</span>
                  {s.requiresVerified && (
                    <span className="block text-xs text-gray-500">{t('verifiedOnly')}</span>
                  )}
                </span>
                <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  ×{s.durationMultiplier.toFixed(1)}
                </span>
              </button>
            ))}
          </div>

          <h2 className="mt-6 text-base font-semibold text-gray-900">{t('addonsHeading')}</h2>
          <div className="mt-3 flex flex-col gap-2">
            {addons.map((a) => {
              const qty = addonQty[a.key] ?? 0;
              const countable = a.unit === 'per_window' || a.unit === 'per_hour';
              return (
                <div
                  key={a.key}
                  className={`flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 ${
                    qty > 0 ? 'border-primary-500' : 'border-gray-200'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={qty > 0}
                    onClick={() => setAddonQty({ ...addonQty, [a.key]: qty > 0 ? 0 : 1 })}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span
                      aria-hidden
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-xs ${
                        qty > 0
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-gray-300 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <span className="truncate text-sm font-medium text-gray-900">{name(a)}</span>
                  </button>
                  {qty > 0 && countable ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAddonQty({ ...addonQty, [a.key]: Math.max(1, qty - 1) })}
                      >
                        −
                      </Button>
                      <span className="min-w-[1.25rem] text-center text-sm font-semibold tabular-nums">
                        {qty}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAddonQty({ ...addonQty, [a.key]: Math.min(20, qty + 1) })}
                      >
                        +
                      </Button>
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs tabular-nums text-gray-500">+{a.hours} h</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="mt-4">
          <h1 className="text-2xl font-bold text-gray-900">{t('step3Heading')}</h1>
          <h2 className="mt-4 text-base font-semibold text-gray-900">{t('dateHeading')}</h2>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {dayChips.map((d) => (
              <button
                key={d.offset}
                type="button"
                aria-pressed={d.offset === dayOffset}
                onClick={() => setDayOffset(d.offset)}
                className={`shrink-0 rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                  d.offset === dayOffset
                    ? 'border-primary-500 bg-primary-500 font-semibold text-white'
                    : 'border-gray-200 bg-white text-gray-900'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <h2 className="mt-5 text-base font-semibold text-gray-900">{t('slotHeading')}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {SLOT_TIMES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={s === slot}
                onClick={() => setSlot(s)}
                className={`rounded-full border-2 px-4 py-2 text-sm tabular-nums transition-colors ${
                  s === slot
                    ? 'border-primary-500 bg-primary-500 font-semibold text-white'
                    : 'border-gray-200 bg-white text-gray-900'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <h2 className="mt-5 text-base font-semibold text-gray-900">{t('recurringHeading')}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {RECURRING.map((r) => (
              <button
                key={r ?? 'once'}
                type="button"
                aria-pressed={r === recurring}
                onClick={() => setRecurring(r)}
                className={`rounded-full border-2 px-4 py-2 text-sm transition-colors ${
                  r === recurring
                    ? 'border-primary-500 bg-primary-500 font-semibold text-white'
                    : 'border-gray-200 bg-white text-gray-900'
                }`}
              >
                {t(`recurring_${r ?? 'once'}`)}
                {r && discounts[r] ? ` · −${discounts[r]} %` : ''}
              </button>
            ))}
          </div>
          <p className="mt-5 text-xs text-gray-500">{t('nextStepsNote')}</p>
        </section>
      )}

      {/* Sticky live-total bar (H1) — total only; back lives in the header */}
      <div className="fixed inset-x-0 bottom-0 flex justify-center border-t border-gray-200 bg-white">
        <div className="flex w-full max-w-lg items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">{t('totalLabel')}</p>
            <p className="truncate text-lg font-bold tabular-nums text-gray-900">
              {quote?.kind === 'range'
                ? t('totalRange', { min: formatKM(quote.min.totalF), max: formatKM(quote.max.totalF) })
                : quote?.kind === 'exact'
                  ? formatKM(quote.quote.totalF)
                  : '—'}
            </p>
            {quote?.kind === 'range' && (
              <p className="text-xs text-gray-500">{t('hoursEstimate', { hours: quote.min.estHours })}</p>
            )}
          </div>
          <Button
            className="shrink-0"
            disabled={!canNext}
            loading={submitting}
            onClick={() => (step < 3 ? setStep(step + 1) : void submit())}
          >
            {step < 3 ? t('next') : t('finish')}
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function BookServicePage() {
  return (
    <ToastProvider>
      <WizardInner />
    </ToastProvider>
  );
}
