'use client';

import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';

type Status = 'idle' | 'sending' | 'done' | 'error';

export interface NewsletterFormProps {
  /** Recorded against the subscriber so campaigns can be attributed. */
  source?: 'popup' | 'footer' | 'exit_intent' | 'checkout';
  /** Unique per instance — the footer and the homepage both render one. */
  id?: string;
  variant?: 'light' | 'dark';
  className?: string;
}

/**
 * Newsletter opt-in.
 *
 * Progressive enhancement: the markup is a real form posting to
 * `/api/newsletter`, so it still subscribes if hydration never happens. When JS
 * is running we intercept and answer inline instead of navigating away.
 */
export function NewsletterForm({
  source = 'footer',
  id = 'newsletter-email',
  variant = 'light',
  className = '',
}: NewsletterFormProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  const dark = variant === 'dark';

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'sending') return;

    setStatus('sending');
    setMessage('');

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus('error');
        setMessage(body?.error?.message ?? 'That did not work. Please try again.');
        return;
      }

      setStatus('done');
      setMessage(
        body?.data?.alreadySubscribed
          ? "You're already on the list."
          : "You're in. Check your inbox for a welcome note.",
      );
      setEmail('');
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  if (status === 'done') {
    return (
      <p
        className={`flex items-center gap-2 text-sm ${dark ? 'text-paper' : 'text-ink'} ${className}`}
        role="status"
      >
        <Check className="w-4 h-4 text-success shrink-0" aria-hidden="true" />
        {message}
      </p>
    );
  }

  return (
    <div className={className}>
      <form
        onSubmit={onSubmit}
        action="/api/newsletter"
        method="POST"
        className="flex flex-col sm:flex-row gap-3"
      >
        <label htmlFor={id} className="sr-only">
          Email address
        </label>
        <input
          type="email"
          id={id}
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          autoComplete="email"
          required
          aria-invalid={status === 'error' || undefined}
          aria-describedby={status === 'error' ? `${id}-error` : undefined}
          className={
            dark
              ? 'flex-1 min-w-0 px-4 py-3 bg-ink-3 border border-ink-2 rounded-md text-paper placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all'
              : 'flex-1 min-w-0 px-4 py-4 bg-paper border border-line rounded-md text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all'
          }
        />
        <input type="hidden" name="source" value={source} />
        <button
          type="submit"
          disabled={status === 'sending'}
          className={
            dark
              ? 'px-6 py-3 bg-accent text-paper font-medium rounded-md hover:bg-accent/90 disabled:opacity-60 transition-colors u-focus whitespace-nowrap inline-flex items-center justify-center gap-2'
              : 'px-8 py-4 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 disabled:opacity-60 transition-colors u-focus whitespace-nowrap inline-flex items-center justify-center gap-2'
          }
        >
          {status === 'sending' ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : null}
          {status === 'sending' ? 'Subscribing' : 'Subscribe'}
        </button>
      </form>
      {status === 'error' ? (
        <p id={`${id}-error`} className="text-sm text-danger mt-2" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
