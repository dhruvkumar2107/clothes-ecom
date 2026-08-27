'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/app/providers';
import {
  Plus,
  MapPin,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  Truck,
  Banknote,
  AlertTriangle,
} from 'lucide-react';

export interface AddressRecord {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  stateCode: string | null;
  pincode: string;
  country: string;
  isDefault: boolean;
}

interface Draft {
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

/** Serviceability, as far as this form cares about it. */
interface PinInfo {
  serviceable: boolean;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  codAvailable: boolean;
  etaLabel: string;
  reason: string | null;
  known: boolean;
}

const EMPTY: Draft = {
  label: 'home',
  name: '',
  phone: '',
  line1: '',
  line2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  isDefault: false,
};

const LABEL_OPTIONS = [
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'other', label: 'Other' },
];

/** The API's own rule, restated so the form can reject before a round trip. */
const PINCODE_RE = /^[1-9][0-9]{5}$/;
const PHONE_RE = /^\+?[1-9]\d{9,14}$/;

function toDraft(address: AddressRecord): Draft {
  return {
    label: address.label,
    name: address.name,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2 ?? '',
    landmark: address.landmark ?? '',
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    isDefault: address.isDefault,
  };
}

/**
 * The address book.
 *
 * Owns the list after first paint so an add, edit or delete shows immediately
 * instead of waiting on a server round trip and a re-render — the server
 * component hands over the initial rows and this takes it from there.
 */
export function AddressBook({ initial }: { initial: AddressRecord[] }) {
  const { toast } = useToast();
  const [addresses, setAddresses] = useState(initial);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(initial.length === 0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [deleting, setDeleting] = useState<AddressRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [pin, setPin] = useState<PinInfo | null>(null);
  const [pinBusy, setPinBusy] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  /**
   * Look up the PIN code as it is typed, and use the answer to fill city and
   * state. Debounced, and every response is checked against the current value
   * before it is applied so a slow reply for an old PIN can't overwrite a newer
   * one.
   */
  useEffect(() => {
    const pincode = draft.pincode.trim();
    if (!PINCODE_RE.test(pincode)) {
      setPin(null);
      return;
    }

    let cancelled = false;
    setPinBusy(true);

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/shipping/serviceability?pincode=${pincode}`);
        const body = await response.json().catch(() => null);
        if (cancelled) return;

        const info: PinInfo | null = body?.data?.serviceability ?? null;
        setPin(info);

        // Only autofill when the PIN is one we actually know, and never clobber
        // something the customer typed themselves.
        if (info?.known) {
          setDraft((current) => {
            if (current.pincode.trim() !== pincode) return current;
            return {
              ...current,
              city: current.city || (info.city ?? ''),
              state: current.state || (info.state ?? ''),
            };
          });
        }
      } catch {
        if (!cancelled) setPin(null);
      } finally {
        if (!cancelled) setPinBusy(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      setPinBusy(false);
    };
  }, [draft.pincode]);

  function validate(d: Draft) {
    const next: Partial<Record<keyof Draft, string>> = {};
    if (!d.name.trim()) next.name = 'Required';
    if (!PHONE_RE.test(d.phone.trim())) next.phone = 'Enter a 10-digit mobile number';
    if (!d.line1.trim()) next.line1 = 'Required';
    if (!d.city.trim()) next.city = 'Required';
    if (!d.state.trim()) next.state = 'Required';
    if (!PINCODE_RE.test(d.pincode.trim())) next.pincode = 'Enter a valid 6-digit PIN code';
    return next;
  }

  function openForm(address?: AddressRecord) {
    if (address) {
      setEditingId(address.id);
      setDraft(toDraft(address));
    } else {
      setEditingId(null);
      setDraft(EMPTY);
    }
    setErrors({});
    setPin(null);
    setFormOpen(true);
    // Let the panel mount before scrolling to it.
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nameRef.current?.focus();
    });
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setDraft(EMPTY);
    setErrors({});
    setPin(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const payload = {
      label: draft.label,
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      line1: draft.line1.trim(),
      line2: draft.line2.trim() || null,
      landmark: draft.landmark.trim() || null,
      city: draft.city.trim(),
      state: draft.state.trim(),
      stateCode: pin?.stateCode ?? null,
      pincode: draft.pincode.trim(),
      country: 'IN',
      isDefault: draft.isDefault,
    };

    try {
      const response = await fetch(
        editingId ? `/api/account/addresses/${editingId}` : '/api/account/addresses',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        toast({
          tone: 'danger',
          message: body?.error?.message ?? 'Could not save this address.',
        });
        return;
      }

      const saved: AddressRecord = body?.data?.data ?? body?.data;
      setAddresses((current) => {
        // A new default demotes every other row — the server did the same.
        const cleared = saved.isDefault
          ? current.map((a) => ({ ...a, isDefault: false }))
          : current;
        const without = cleared.filter((a) => a.id !== saved.id);
        return [...without, saved].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
      });

      toast({ tone: 'success', message: editingId ? 'Address updated.' : 'Address saved.' });
      closeForm();
    } catch {
      toast({ tone: 'danger', message: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(address: AddressRecord) {
    // Optimistic — this is a one-field toggle and rolling it back is cheap.
    const previous = addresses;
    setAddresses((current) =>
      current
        .map((a) => ({ ...a, isDefault: a.id === address.id }))
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault)),
    );

    try {
      const response = await fetch(`/api/account/addresses/${address.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!response.ok) throw new Error('failed');
      toast({ tone: 'success', message: 'Default address updated.' });
    } catch {
      setAddresses(previous);
      toast({ tone: 'danger', message: 'Could not change the default address.' });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const response = await fetch(`/api/account/addresses/${deleting.id}`, { method: 'DELETE' });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        toast({
          tone: 'danger',
          message: body?.error?.message ?? 'Could not delete this address.',
        });
        return;
      }

      setAddresses((current) => current.filter((a) => a.id !== deleting.id));
      if (editingId === deleting.id) closeForm();
      toast({ tone: 'success', message: 'Address removed.' });
      setDeleting(null);
    } catch {
      toast({ tone: 'danger', message: 'Network error. Please try again.' });
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="u-display text-3xl mb-1">Saved Addresses</h1>
          <p className="text-muted">Manage your delivery addresses for faster checkout</p>
        </div>
        {addresses.length > 0 ? (
          <Button onClick={() => openForm()} className="gap-2">
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add Address
          </Button>
        ) : null}
      </div>

      {addresses.length === 0 && !formOpen ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-ink/10 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-muted" aria-hidden="true" />
          </div>
          <h2 className="u-display text-xl mb-2">No addresses saved</h2>
          <p className="text-muted mb-6">Add an address to speed up checkout</p>
          <Button onClick={() => openForm()}>Add Address</Button>
        </div>
      ) : null}

      {addresses.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((addr) => (
            <li
              key={addr.id}
              className={`relative p-5 bg-paper rounded-lg border-2 transition-colors ${
                addr.isDefault ? 'border-accent bg-accent/5' : 'border-line hover:border-ink/50'
              }`}
            >
              {addr.isDefault ? (
                <span className="absolute -top-2 right-4 px-2 py-0.5 bg-accent text-paper text-xs rounded-full font-medium">
                  Default
                </span>
              ) : null}
              <address className="not-italic">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <span className="font-medium text-ink">{addr.name}</span>
                    <span className="u-label text-muted-2 ml-2 capitalize">{addr.label}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openForm(addr)}
                      className="p-1.5 rounded text-muted hover:text-ink hover:bg-paper-3 transition-colors u-focus"
                      aria-label={`Edit address for ${addr.name}`}
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(addr)}
                      className="p-1.5 rounded text-muted hover:text-danger hover:bg-paper-3 transition-colors u-focus"
                      aria-label={`Delete address for ${addr.name}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-muted mb-1">{addr.phone}</p>
                <p className="text-sm text-muted mb-1">
                  {addr.line1}
                  {addr.line2 ? `, ${addr.line2}` : ''}
                </p>
                {addr.landmark ? <p className="text-sm text-muted mb-1">{addr.landmark}</p> : null}
                <p className="text-sm text-muted">
                  {addr.city}, {addr.state} {addr.pincode}
                </p>
              </address>
              {!addr.isDefault ? (
                <button
                  type="button"
                  onClick={() => makeDefault(addr)}
                  className="u-label mt-4 text-accent hover:underline underline-offset-4 u-focus"
                >
                  Set as default
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {formOpen ? (
        <div
          ref={formRef}
          id="new-address"
          className="mt-10 p-6 bg-paper rounded-lg border border-line scroll-mt-24"
        >
          <div className="flex items-center justify-between gap-4 mb-6">
            <h2 className="u-display text-xl flex items-center gap-2">
              {editingId ? (
                <Pencil className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Plus className="w-5 h-5" aria-hidden="true" />
              )}
              {editingId ? 'Edit Address' : 'Add New Address'}
            </h2>
            {addresses.length > 0 ? (
              <button
                type="button"
                onClick={closeForm}
                className="p-1.5 rounded text-muted hover:text-ink hover:bg-paper-3 transition-colors u-focus"
                aria-label="Close form"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <form className="space-y-4" onSubmit={save} noValidate>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                ref={nameRef}
                id="addr-name"
                label="Full Name"
                required
                autoComplete="name"
                value={draft.name}
                error={errors.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <Input
                id="addr-phone"
                label="Phone"
                type="tel"
                inputMode="numeric"
                required
                autoComplete="tel"
                placeholder="9876543210"
                value={draft.phone}
                error={errors.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </div>

            <Input
              id="addr-line1"
              label="Address Line 1"
              required
              autoComplete="address-line1"
              placeholder="Flat / House no., Building"
              value={draft.line1}
              error={errors.line1}
              onChange={(e) => setDraft({ ...draft, line1: e.target.value })}
            />
            <Input
              id="addr-line2"
              label="Address Line 2"
              autoComplete="address-line2"
              placeholder="Street, Area"
              value={draft.line2}
              onChange={(e) => setDraft({ ...draft, line2: e.target.value })}
            />
            <Input
              id="addr-landmark"
              label="Landmark"
              placeholder="Near…"
              value={draft.landmark}
              onChange={(e) => setDraft({ ...draft, landmark: e.target.value })}
            />

            <div className="grid sm:grid-cols-3 gap-4">
              <Input
                id="addr-pincode"
                label="PIN Code"
                required
                inputMode="numeric"
                maxLength={6}
                autoComplete="postal-code"
                value={draft.pincode}
                error={errors.pincode}
                suffix={
                  pinBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-2" aria-hidden="true" />
                  ) : pin?.serviceable ? (
                    <Check className="w-4 h-4 text-success" aria-hidden="true" />
                  ) : pin && !pin.serviceable ? (
                    <AlertTriangle className="w-4 h-4 text-danger" aria-hidden="true" />
                  ) : undefined
                }
                onChange={(e) =>
                  setDraft({ ...draft, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })
                }
              />
              <Input
                id="addr-city"
                label="City"
                required
                autoComplete="address-level2"
                value={draft.city}
                error={errors.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              />
              <Input
                id="addr-state"
                label="State"
                required
                autoComplete="address-level1"
                value={draft.state}
                error={errors.state}
                onChange={(e) => setDraft({ ...draft, state: e.target.value })}
              />
            </div>

            {pin ? (
              <div
                className={`rounded-md border p-3 text-sm ${
                  pin.serviceable
                    ? 'border-success/30 bg-success/5 text-ink'
                    : 'border-danger/30 bg-danger/5 text-ink'
                }`}
                role="status"
              >
                {pin.serviceable ? (
                  <>
                    <p className="flex items-center gap-2 font-medium">
                      <Truck className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
                      {pin.etaLabel}
                    </p>
                    <p className="flex items-center gap-2 text-muted mt-1">
                      <Banknote className="w-4 h-4 shrink-0" aria-hidden="true" />
                      {pin.codAvailable
                        ? 'Cash on delivery available'
                        : 'Prepaid only — no cash on delivery at this PIN code'}
                    </p>
                  </>
                ) : (
                  <p className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-danger shrink-0" aria-hidden="true" />
                    {pin.reason ?? "We don't deliver to this PIN code yet."}
                  </p>
                )}
              </div>
            ) : null}

            <div className="grid sm:grid-cols-2 gap-4 items-start">
              <Select
                id="addr-label"
                label="Address Type"
                options={LABEL_OPTIONS}
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              />
              <div className="sm:pt-7">
                <Checkbox
                  id="addr-default"
                  label="Set as default address"
                  checked={draft.isDefault}
                  onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : null}
                {saving ? 'Saving' : editingId ? 'Update Address' : 'Save Address'}
              </Button>
              {addresses.length > 0 ? (
                <Button type="button" variant="outline" onClick={closeForm} disabled={saving}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={deleteBusy}
        danger
        title="Delete this address?"
        message={
          deleting
            ? `${deleting.name}, ${deleting.line1}, ${deleting.city} ${deleting.pincode} will be removed from your address book.`
            : ''
        }
        confirmLabel="Delete"
      />
    </>
  );
}
