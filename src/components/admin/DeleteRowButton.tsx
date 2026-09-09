'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';

export interface DeleteRowButtonProps {
  endpoint: string;
  name: string;
  kind?: string;
  title?: string;
}

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
      <span className="text-[10px] text-red-500" role="alert">
        {error}
      </span>
    );
  }

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-[10px] text-[#9E9789] hidden sm:inline">Delete {name}?</span>
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="px-2 py-1 rounded bg-red-50 text-red-600 border border-red-200 text-[10px] font-semibold uppercase tracking-wider hover:bg-red-100 disabled:opacity-60 transition-colors"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          disabled={busy}
          className="px-2 py-1 rounded text-[#7A7468] border border-[#E8E5DE] text-[10px] font-semibold uppercase tracking-wider hover:bg-[#F3F1ED] disabled:opacity-60 transition-colors"
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
      className="p-1.5 text-[#9E9789] hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
      title={title ?? `Delete ${kind}`}
      aria-label={`Delete ${name}`}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
