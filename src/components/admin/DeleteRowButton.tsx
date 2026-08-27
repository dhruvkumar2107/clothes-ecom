'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';

export interface DeleteRowButtonProps {
  /** API endpoint that accepts DELETE for this row. */
  endpoint: string;
  /** Shown in the confirmation prompt so the operator sees what they are about to remove. */
  name: string;
  /** What is being deleted, lowercase — "product", "coupon", "banner". */
  kind?: string;
  title?: string;
}

/**
 * Delete one admin row.
 *
 * Admin list pages are server components, so the click handler has to live in a
 * client island. Confirmation is a two-step inline swap rather than a modal —
 * it keeps the table row as the unit of interaction and needs no focus trap.
 */
export function DeleteRowButton({
  endpoint,
  name,
  kind = 'item',
  title,
}: DeleteRowButtonProps) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(endpoint, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error?.message ?? `Could not delete this ${kind}.`);
        setArmed(false);
        return;
      }
      // The list is server-rendered; ask the server for a fresh one.
      router.refresh();
    } catch {
      setError('Network error.');
      setArmed(false);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <span className="text-[10px] text-rose-400" role="alert">
        {error}
      </span>
    );
  }

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[10px] text-zinc-400 hidden sm:inline">Delete {name}?</span>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-semibold uppercase tracking-wider hover:bg-rose-500/30 disabled:opacity-60 transition-colors"
        >
          {busy ? (
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          ) : (
            'Confirm'
          )}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          disabled={busy}
          className="px-2 py-1 rounded text-zinc-400 border border-zinc-700 text-[10px] font-semibold uppercase tracking-wider hover:bg-zinc-800 disabled:opacity-60 transition-colors"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
      title={title ?? `Delete ${kind}`}
      aria-label={`Delete ${name}`}
    >
      <Trash2 className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}
