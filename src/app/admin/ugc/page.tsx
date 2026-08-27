'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Check, X, Eye, Camera, Shield, Clock } from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface UGCSubmission {
  id: string;
  imageUrl: string;
  userName: string;
  productName: string;
  productSlug: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  caption?: string;
}

export default function UGCModPage() {
  const [submissions, setSubmissions] = useState<UGCSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    async function load() {
      try {
        const result = await apiGet<{ data: UGCSubmission[] }>('/api/admin/ugc');
        setSubmissions(result.data || []);
      } catch {
        // Fallback empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = submissions.filter((s) => s.status === filter);
  const pendingCount = submissions.filter((s) => s.status === 'pending').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 pb-6 border-b border-zinc-800/80">
        <Link href="/admin/dashboard" className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">UGC Moderation Queue</h1>
          <p className="text-xs text-zinc-400 mt-1">Review and approve customer-submitted photos for the community wall.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {(['pending', 'approved', 'rejected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`p-4 rounded-xl border transition-all ${
              filter === status
                ? 'bg-zinc-800 border-amber-500/50 shadow-lg'
                : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 capitalize">{status}</span>
              {status === 'pending' && pendingCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-bold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-100 mt-2">
              {submissions.filter((s) => s.status === status).length}
            </div>
          </button>
        ))}
      </div>

      {/* Submissions grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <Camera className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
          <p className="text-lg">No {filter} submissions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((sub) => (
            <div key={sub.id} className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl">
              <div className="relative aspect-square">
                <Image src={sub.imageUrl} alt={sub.userName} fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                <div className="absolute top-3 right-3 flex gap-2">
                  <span className={`px-2 py-1 rounded text-[10px] font-semibold uppercase ${
                    sub.status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                    sub.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {sub.status}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-amber-400">{sub.userName.charAt(0)}</span>
                  </div>
                  <span className="text-sm text-zinc-200 font-medium">{sub.userName}</span>
                </div>
                <p className="text-xs text-zinc-400 mb-1">
                  Wearing: <Link href={`/products/${sub.productSlug}`} className="text-amber-400 hover:text-amber-300">{sub.productName}</Link>
                </p>
                {sub.caption && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{sub.caption}</p>}
                <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {new Date(sub.submittedAt).toLocaleDateString()}
                </p>

                {sub.status === 'pending' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-zinc-800/80">
                    <button className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium rounded hover:bg-emerald-500/20 transition-colors">
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button className="flex-1 flex items-center justify-center gap-1 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium rounded hover:bg-rose-500/20 transition-colors">
                      <X className="w-3 h-3" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
