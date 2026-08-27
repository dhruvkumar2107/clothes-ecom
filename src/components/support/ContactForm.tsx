'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, AlertCircle, Send } from 'lucide-react';

const TOPICS = [
  { value: 'general', label: 'General enquiry' },
  { value: 'order', label: 'An order I placed' },
  { value: 'return', label: 'A return or exchange' },
  { value: 'product', label: 'A question about a product' },
  { value: 'payment', label: 'Payment or refund' },
  { value: 'wholesale', label: 'Wholesale / stockist' },
  { value: 'press', label: 'Press' },
];

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  orderNumber: '',
  topic: 'general',
  subject: '',
  message: '',
};

type Draft = typeof EMPTY;
type FieldErrors = Partial<Record<keyof Draft, string>>;

/**
 * The contact form.
 *
 * Progressive enhancement: this is a real form posting to `/api/contact`, so it
 * still files an enquiry if hydration never happens. With JavaScript running we
 * intercept, validate locally first, and show the ticket reference inline
 * instead of navigating away.
 */
export function ContactForm() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // Clear the error the moment the field is touched — re-showing it on submit
    // is less annoying than watching it sit there while you fix it.
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  /** The API's own rules, restated so the form can reject before a round trip. */
  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (draft.name.trim().length < 2) next.name = 'Tell us your name';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim()))
      next.email = 'That email does not look right';
    if (draft.phone.trim() && !/^\+?[1-9]\d{9,14}$/.test(draft.phone.trim()))
      next.phone = 'Enter a valid phone number, or leave it blank';
    if (draft.subject.trim().length < 3) next.subject = 'Add a short subject';
    if (draft.message.trim().length < 20)
      next.message = 'Please give us a little more detail — at least 20 characters';
    return next;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailed(null);

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const field = body?.error?.field as keyof Draft | undefined;
        const message = body?.error?.message ?? 'Could not send your message.';
        if (field) setErrors({ [field]: message });
        else setFailed(message);
        return;
      }

      setSent(body?.data?.ref ?? null);
      setDraft(EMPTY);
    } catch {
      setFailed('Network error — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div
        className="border border-success/30 bg-success/5 rounded-lg p-8 text-center"
        role="status"
      >
        <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-4" aria-hidden="true" />
        <h2 className="u-title text-lg font-semibold text-ink mb-2">Message received</h2>
        <p className="text-ink-2 leading-relaxed">
          We have sent an acknowledgement to your email. We answer within one working day.
        </p>
        {sent ? (
          <p className="mt-4 text-sm text-ink-3">
            Your reference is{' '}
            <span className="font-mono font-semibold text-ink tracking-wide">{sent}</span> — quote
            it if you follow up.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setSent(null)}
          className="mt-6 text-sm text-ink-2 hover:text-ink underline underline-offset-4 u-focus"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form
      id="contact-form"
      method="POST"
      action="/api/contact"
      onSubmit={submit}
      className="space-y-5"
      noValidate
    >
      {failed ? (
        <div
          className="flex gap-3 border border-danger/30 bg-danger/5 rounded-lg px-4 py-3 text-sm text-danger"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{failed}</span>
        </div>
      ) : null}

      <div className="grid sm:grid-cols-2 gap-5">
        <Input
          id="contact-name"
          name="name"
          label="Your name"
          autoComplete="name"
          required
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
        />
        <Input
          id="contact-email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          required
          value={draft.email}
          onChange={(e) => set('email', e.target.value)}
          error={errors.email}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <Input
          id="contact-phone"
          name="phone"
          type="tel"
          label="Phone"
          hint="Optional — faster for anything about a live delivery"
          autoComplete="tel"
          value={draft.phone}
          onChange={(e) => set('phone', e.target.value)}
          error={errors.phone}
        />
        <Select
          id="contact-topic"
          name="topic"
          label="What is this about?"
          options={TOPICS}
          value={draft.topic}
          onChange={(e) => set('topic', e.target.value)}
        />
      </div>

      {draft.topic === 'order' || draft.topic === 'return' || draft.topic === 'payment' ? (
        <Input
          id="contact-order"
          name="orderNumber"
          label="Order number"
          hint="On your confirmation email, like LMN-2627-001234"
          value={draft.orderNumber}
          onChange={(e) => set('orderNumber', e.target.value)}
        />
      ) : null}

      <Input
        id="contact-subject"
        name="subject"
        label="Subject"
        required
        value={draft.subject}
        onChange={(e) => set('subject', e.target.value)}
        error={errors.subject}
      />

      <Textarea
        id="contact-message"
        name="message"
        label="Message"
        rows={6}
        required
        hint={`${draft.message.trim().length}/4000`}
        value={draft.message}
        onChange={(e) => set('message', e.target.value)}
        error={errors.message}
        maxLength={4000}
      />

      <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">
        <Send className="w-4 h-4" aria-hidden="true" />
        Send message
      </Button>

      <p className="text-xs text-muted-2 leading-relaxed">
        We use what you send only to answer you. See our privacy policy for how long we keep it.
      </p>
    </form>
  );
}
