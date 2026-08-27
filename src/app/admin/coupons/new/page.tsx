'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function NewCouponPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    code: '',
    name: '',
    kind: 'percent',
    value: '',
    minCartValue: '',
    maxUses: '',
    startsAt: '',
    endsAt: '',
    active: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.toUpperCase(),
          name: form.name || null,
          kind: form.kind,
          value: Number(form.value),
          minCartValue: form.minCartValue ? Number(form.minCartValue) : null,
          maxUses: form.maxUses ? Number(form.maxUses) : null,
          startsAt: form.startsAt || null,
          endsAt: form.endsAt || null,
          active: form.active,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Failed to create coupon');
        return;
      }
      router.push('/admin/coupons');
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 pb-6 border-b border-zinc-800/80">
        <Link href="/admin/coupons" className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Create Coupon</h1>
          <p className="text-xs text-zinc-400 mt-1">Set up a new promotional code for customers.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 shadow-2xl">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{error}</div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Code *</label>
            <input type="text" value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} required placeholder="e.g. SUMMER20" className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Summer Sale" className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Type *</label>
            <select value={form.kind} onChange={(e) => setForm(f => ({ ...f, kind: e.target.value }))} className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/60">
              <option value="percent">Percent Off</option>
              <option value="fixed">Fixed Amount</option>
              <option value="free_shipping">Free Shipping</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Value *</label>
            <input type="number" value={form.value} onChange={(e) => setForm(f => ({ ...f, value: e.target.value }))} required placeholder={form.kind === 'percent' ? 'e.g. 20' : 'e.g. 50000'} min="0" className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Min Cart Value (paise)</label>
            <input type="number" value={form.minCartValue} onChange={(e) => setForm(f => ({ ...f, minCartValue: e.target.value }))} placeholder="No minimum" min="0" className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Max Uses</label>
            <input type="number" value={form.maxUses} onChange={(e) => setForm(f => ({ ...f, maxUses: e.target.value }))} placeholder="Unlimited" min="1" className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Start Date</label>
            <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm(f => ({ ...f, startsAt: e.target.value }))} className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/60" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">End Date</label>
            <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm(f => ({ ...f, endsAt: e.target.value }))} className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/60" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="active" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500/60" />
          <label htmlFor="active" className="text-sm text-zinc-300">Active</label>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-zinc-800/80">
          <Link href="/admin/coupons" className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 border border-zinc-700 rounded-lg transition-colors">Cancel</Link>
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create Coupon
          </button>
        </div>
      </form>
    </div>
  );
}
