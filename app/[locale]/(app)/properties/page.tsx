'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Select,
  Textarea,
  ToastProvider,
  useToast,
} from '@/app/components/ui';

// Properties CRUD + host checklists (E3.1, plan §3: hosts save multiple
// properties with address, m², access notes and turnover checklists).
// Server is authoritative — this page only talks to /api/properties.

interface Checklist {
  linens: boolean;
  restock: string[];
  damageReport: boolean;
}

interface Property {
  id: string;
  label: string | null;
  type: 'apartment' | 'house' | 'office' | 'vacation_rental';
  city: { slug: string; name: string } | null;
  street: string | null;
  houseNo: string | null;
  floor: string | null;
  hasElevator: boolean;
  sizeM2: number | null;
  rooms: number | null;
  bathrooms: number | null;
  pets: boolean;
  accessNotes: string | null;
  checklist: Checklist | null;
  isAirbnb: boolean;
}

interface FormState {
  label: string;
  type: Property['type'];
  street: string;
  houseNo: string;
  floor: string;
  hasElevator: boolean;
  sizeM2: string;
  rooms: string;
  bathrooms: string;
  pets: boolean;
  accessNotes: string;
  isAirbnb: boolean;
  linens: boolean;
  restock: string[];
  damageReport: boolean;
}

const emptyForm: FormState = {
  label: '',
  type: 'apartment',
  street: '',
  houseNo: '',
  floor: '',
  hasElevator: false,
  sizeM2: '',
  rooms: '',
  bathrooms: '',
  pets: false,
  accessNotes: '',
  isAirbnb: false,
  linens: true,
  restock: [],
  damageReport: true,
};

function formFrom(p: Property): FormState {
  return {
    label: p.label ?? '',
    type: p.type,
    street: p.street ?? '',
    houseNo: p.houseNo ?? '',
    floor: p.floor ?? '',
    hasElevator: p.hasElevator,
    sizeM2: p.sizeM2?.toString() ?? '',
    rooms: p.rooms?.toString() ?? '',
    bathrooms: p.bathrooms?.toString() ?? '',
    pets: p.pets,
    accessNotes: p.accessNotes ?? '',
    isAirbnb: p.isAirbnb,
    linens: p.checklist?.linens ?? true,
    restock: p.checklist?.restock ?? [],
    damageReport: p.checklist?.damageReport ?? true,
  };
}

function payloadFrom(form: FormState) {
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
  return {
    label: form.label.trim() || undefined,
    type: form.type,
    street: form.street.trim() || undefined,
    houseNo: form.houseNo.trim() || undefined,
    floor: form.floor.trim() || undefined,
    hasElevator: form.hasElevator,
    sizeM2: num(form.sizeM2),
    rooms: num(form.rooms),
    bathrooms: num(form.bathrooms),
    pets: form.pets,
    accessNotes: form.accessNotes.trim() || undefined,
    isAirbnb: form.isAirbnb,
    ...(form.isAirbnb || form.type === 'vacation_rental'
      ? {
          checklist: {
            linens: form.linens,
            restock: form.restock,
            damageReport: form.damageReport,
          },
        }
      : {}),
  };
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-900">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
      />
      {label}
    </label>
  );
}

const TYPE_LABEL_KEY: Record<Property['type'], string> = {
  apartment: 'typeApartment',
  house: 'typeHouse',
  office: 'typeOffice',
  vacation_rental: 'typeVacationRental',
};

function PropertiesInner() {
  const t = useTranslations('Properties');
  const toast = useToast();

  const [properties, setProperties] = useState<Property[] | null>(null);
  const [editing, setEditing] = useState<Property | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Property | null>(null);
  const [restockDraft, setRestockDraft] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/properties');
    if (res.ok) {
      const { data } = await res.json();
      setProperties(data.properties);
    } else {
      setProperties([]);
      toast.show(t('loadError'), 'error');
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const startCreate = () => {
    setForm(emptyForm);
    setEditing('new');
  };
  const startEdit = (p: Property) => {
    setForm(formFrom(p));
    setEditing(p);
  };

  const save = async () => {
    setSaving(true);
    try {
      const isNew = editing === 'new';
      const res = await fetch(
        isNew ? '/api/properties' : `/api/properties/${(editing as Property).id}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadFrom(form)),
        },
      );
      if (!res.ok) {
        toast.show(t('saveError'), 'error');
        return;
      }
      toast.show(t('saved'), 'success');
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    const res = await fetch(`/api/properties/${deleting.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.show(t('deleted'), 'success');
      await load();
    } else {
      const json = await res.json().catch(() => null);
      toast.show(
        json?.error?.code === 'PROPERTY_IN_USE' ? t('deleteInUse') : t('deleteError'),
        'error',
      );
    }
    setDeleting(null);
  };

  const addRestockItem = () => {
    const item = restockDraft.trim();
    if (item && !form.restock.includes(item) && form.restock.length < 20) {
      setForm((f) => ({ ...f, restock: [...f.restock, item] }));
    }
    setRestockDraft('');
  };

  const showChecklist = form.isAirbnb || form.type === 'vacation_rental';

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        {editing === null && <Button onClick={startCreate}>{t('add')}</Button>}
      </div>

      {editing !== null && (
        <form
          className="mt-6 flex flex-col gap-4 rounded-2xl border border-gray-200 p-4 sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h2 className="text-lg font-semibold text-gray-900">
            {editing === 'new' ? t('addTitle') : t('editTitle')}
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('label')}
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder={t('labelPlaceholder')}
            />
            <Select
              label={t('type')}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as Property['type'] })}
            >
              <option value="apartment">{t('typeApartment')}</option>
              <option value="house">{t('typeHouse')}</option>
              <option value="office">{t('typeOffice')}</option>
              <option value="vacation_rental">{t('typeVacationRental')}</option>
            </Select>
            <Input
              label={t('street')}
              value={form.street}
              onChange={(e) => setForm({ ...form, street: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('houseNo')}
                value={form.houseNo}
                onChange={(e) => setForm({ ...form, houseNo: e.target.value })}
              />
              <Input
                label={t('floor')}
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
              />
            </div>
            <Input
              label={t('sizeM2')}
              type="number"
              min={1}
              max={2000}
              value={form.sizeM2}
              onChange={(e) => setForm({ ...form, sizeM2: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={t('rooms')}
                type="number"
                min={1}
                max={50}
                value={form.rooms}
                onChange={(e) => setForm({ ...form, rooms: e.target.value })}
              />
              <Input
                label={t('bathrooms')}
                type="number"
                min={1}
                max={20}
                value={form.bathrooms}
                onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Toggle
              label={t('hasElevator')}
              checked={form.hasElevator}
              onChange={(v) => setForm({ ...form, hasElevator: v })}
            />
            <Toggle label={t('pets')} checked={form.pets} onChange={(v) => setForm({ ...form, pets: v })} />
            <Toggle
              label={t('isAirbnb')}
              checked={form.isAirbnb}
              onChange={(v) => setForm({ ...form, isAirbnb: v })}
            />
          </div>

          <Textarea
            label={t('accessNotes')}
            hint={t('accessNotesHint')}
            value={form.accessNotes}
            onChange={(e) => setForm({ ...form, accessNotes: e.target.value })}
          />

          {showChecklist && (
            <fieldset className="rounded-xl border border-gray-200 p-4">
              <legend className="px-1 text-sm font-semibold text-gray-900">
                {t('checklistTitle')}
              </legend>
              <div className="flex flex-col gap-3">
                <Toggle
                  label={t('checklistLinens')}
                  checked={form.linens}
                  onChange={(v) => setForm({ ...form, linens: v })}
                />
                <Toggle
                  label={t('checklistDamageReport')}
                  checked={form.damageReport}
                  onChange={(v) => setForm({ ...form, damageReport: v })}
                />
                <div>
                  <div className="flex gap-2">
                    <Input
                      label={t('checklistRestock')}
                      hint={t('checklistRestockHint')}
                      value={restockDraft}
                      onChange={(e) => setRestockDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addRestockItem();
                        }
                      }}
                    />
                    <div className="self-end pb-6">
                      <Button type="button" variant="secondary" onClick={addRestockItem}>
                        {t('checklistRestockAdd')}
                      </Button>
                    </div>
                  </div>
                  {form.restock.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {form.restock.map((item) => (
                        <span
                          key={item}
                          className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-700"
                        >
                          {item}
                          <button
                            type="button"
                            aria-label={t('checklistRestockRemove', { item })}
                            onClick={() =>
                              setForm((f) => ({ ...f, restock: f.restock.filter((r) => r !== item) }))
                            }
                            className="text-gray-400 hover:text-gray-600"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </fieldset>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              {t('cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              {t('save')}
            </Button>
          </div>
        </form>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {properties === null ? (
          <div className="animate-pulse rounded-2xl border border-gray-200 p-6 text-sm text-gray-400">
            {t('loading')}
          </div>
        ) : properties.length === 0 && editing === null ? (
          <EmptyState
            title={t('emptyTitle')}
            description={t('emptyDescription')}
            action={<Button onClick={startCreate}>{t('add')}</Button>}
          />
        ) : (
          properties.map((p) => (
            <div key={p.id} className="rounded-2xl border border-gray-200 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">
                      {p.label || t(TYPE_LABEL_KEY[p.type])}
                    </h3>
                    {p.isAirbnb && (
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                        Airbnb
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {[p.street && `${p.street} ${p.houseNo ?? ''}`.trim(), p.city?.name]
                      .filter(Boolean)
                      .join(', ') || t('noAddress')}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {[
                      p.sizeM2 && `${p.sizeM2} m²`,
                      p.rooms && t('roomsShort', { count: p.rooms }),
                      p.bathrooms && t('bathroomsShort', { count: p.bathrooms }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => startEdit(p)}>
                    {t('edit')}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleting(p)}>
                    {t('delete')}
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title={t('deleteTitle')}
        description={t('deleteDescription', { label: deleting?.label ?? '' })}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        destructive
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </main>
  );
}

export default function PropertiesPage() {
  return (
    <ToastProvider>
      <PropertiesInner />
    </ToastProvider>
  );
}
