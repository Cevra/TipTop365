'use client';

import { useState } from 'react';
import {
  Button,
  Input,
  Textarea,
  Select,
  EmptyState,
  StatusBadge,
  StatusTimeline,
  PriceBreakdown,
  RatingStars,
  TagPicker,
  CountdownPill,
  Stepper,
  PhotoUploader,
  MapView,
  ConfirmDialog,
  ToastProvider,
  useToast,
} from '@/app/components/ui';
import { BOOKING_STATUSES } from '@/lib/shared/bookingStatus';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-gray-200 py-8">
      <h2 className="mb-4 text-lg font-bold text-primary-600">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function ToastDemo() {
  const { show } = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => show('Sačuvano!', 'success')}>Success toast</Button>
      <Button size="sm" variant="destructive" onClick={() => show('Nešto je pošlo po zlu', 'error')}>Error toast</Button>
      <Button size="sm" variant="ghost" onClick={() => show('Informacija', 'info')}>Info toast</Button>
    </div>
  );
}

export default function StyleguideClient() {
  const [stars, setStars] = useState(4);
  const [tags, setTags] = useState<string[]>(['temeljito']);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900">TipTop365 — Styleguide</h1>
        <p className="mt-1 text-sm text-gray-500">
          Living component library (plan §20.4). Dev-only. Compose screens from these — never ad-hoc.
        </p>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </Section>

        <Section title="Form fields">
          <Input label="Email" placeholder="ime@primjer.com" hint="Nikad ga ne dijelimo." />
          <Input label="Lozinka" type="password" error="Obavezno polje" />
          <Textarea label="Napomena" placeholder="Detalji o čišćenju…" />
          <Select label="Grad" defaultValue="sarajevo">
            <option value="sarajevo">Sarajevo</option>
            <option value="banja-luka">Banja Luka</option>
          </Select>
        </Section>

        <Section title="Status badges (all lifecycle states)">
          <div className="flex flex-wrap gap-2">
            {BOOKING_STATUSES.map((s) => (
              <StatusBadge key={s} status={s} label={s} />
            ))}
          </div>
        </Section>

        <Section title="Status timeline">
          <StatusTimeline
            currentIndex={2}
            steps={[
              { key: 'a', label: 'Rezervisano', at: '12.7.2026. 10:00' },
              { key: 'b', label: 'Prihvaćeno', at: '12.7.2026. 10:05' },
              { key: 'c', label: 'Čistač na putu' },
              { key: 'd', label: 'Završeno' },
            ]}
          />
        </Section>

        <Section title="Price breakdown (Airbnb-style)">
          <PriceBreakdown
            defaultOpen
            totalF={5760}
            lines={[
              { label: 'Čišćenje (4 h × 12 KM)', amountF: 4800 },
              { label: 'Naknada za uslugu (20%)', amountF: 960, muted: true },
            ]}
          />
        </Section>

        <Section title="Rating + tags">
          <RatingStars value={stars} onChange={setStars} size="lg" />
          <RatingStars value={4} size="sm" />
          <TagPicker
            selected={tags}
            onChange={setTags}
            options={[
              { value: 'temeljito', label: 'Temeljito' },
              { value: 'tacno', label: 'Tačno na vrijeme' },
              { value: 'ljubazno', label: 'Ljubazno' },
            ]}
          />
        </Section>

        <Section title="Countdown + stepper">
          <CountdownPill expiresAt={Date.now() + 90_000} />
          <CountdownPill expiresAt={Date.now() + 20_000} />
          <Stepper current={1} steps={['Nekretnina', 'Usluga', 'Termin', 'Čistač', 'Plaćanje']} />
        </Section>

        <Section title="Photo uploader + map">
          <PhotoUploader roomLabel="Kupatilo" minCount={2} />
          <MapView markers={[{ lat: 43.856, lng: 18.413, label: 'čistač' }]} />
        </Section>

        <Section title="Empty state">
          <EmptyState
            icon={<span className="text-4xl">📭</span>}
            title="Još nema rezervacija"
            description="Kada rezervišete čišćenje, pojaviće se ovdje."
            action={<Button>Rezerviši čišćenje</Button>}
          />
        </Section>

        <Section title="Toast + confirm dialog">
          <ToastDemo />
          <div>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              Otkaži rezervaciju
            </Button>
            <ConfirmDialog
              open={confirmOpen}
              destructive
              title="Otkazati rezervaciju?"
              description="Ova radnja se ne može poništiti. Mogu se primijeniti pravila otkazivanja."
              confirmLabel="Da, otkaži"
              onConfirm={() => setConfirmOpen(false)}
              onCancel={() => setConfirmOpen(false)}
            />
          </div>
        </Section>
      </div>
    </ToastProvider>
  );
}
