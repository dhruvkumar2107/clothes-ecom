'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function NewCollectionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    tagline: '',
    kind: 'editorial',
    heroImage: '',
    accentHex: '',
    featured: false,
    active: true,
    sortOrder: '0',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          description: form.description || null,
          tagline: form.tagline || null,
          kind: form.kind,
          heroImage: form.heroImage || null,
          accentHex: form.accentHex || null,
          featured: form.featured,
          active: form.active,
          sortOrder: Number(form.sortOrder),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Failed to create collection');
        return;
      }
      router.push('/admin/collections');
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 pb-6 border-b border-zinc-800/80">
        <Link href="/admin/collections" className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Create Collection</h1>
          <p className="text-xs text-zinc-400 mt-1">Set up a new product collection for the storefront.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 shadow-2xl">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">{error}</div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Name *</label>
            <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Summer Edit" className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Slug</label>
            <input type="text" value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="Auto-generated from name" className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60 font-mono" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Tagline</label>
          <input type="text" value={form.tagline} onChange={(e) => setForm(f => ({ ...f, tagline: e.target.value }))} placeholder="Short tagline for the collection" className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Description</label>
          <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Full description for the collection" className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60 resize-none" />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Kind</label>
            <select value={form.kind} onChange={(e) => setForm(f => ({ ...f, kind: e.target.value }))} className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/60">
              <option value="editorial">Editorial</option>
              <option value="seasonal">Seasonal</option>
              <option value="lookbook">Lookbook</option>
              <option value="drop">Limited Drop</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Sort Order</label>
            <input type="number" value={form.sortOrder} onChange={(e) => setForm(f => ({ ...f, sortOrder: e.target.value }))} min="0" className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500/60" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Accent Color</label>
            <input type="text" value={form.accentHex} onChange={(e) => setForm(f => ({ ...f, accentHex: e.target.value }))} placeholder="#1a1b1e" className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Hero Image URL</label>
          <input type="url" value={form.heroImage} onChange={(e) => setForm(f => ({ ...f, heroImage: e.target.value }))} placeholder="https://..." className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60" />
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm(f => ({ ...f, featured: e.target.checked }))} className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500/60" />
            <span className="text-sm text-zinc-300">Featured</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-amber-500 focus:ring-amber-500/60" />
            <span className="text-sm text-zinc-300">Active</span>
          </label>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-zinc-800/80">
          <Link href="/admin/collections" className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 border border-zinc-700 rounded-lg transition-colors">Cancel</Link>
          <button type="submit" disabled={loading} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Create Collection
          </button>
        </div>
      </form>
    </div>
  );
}
