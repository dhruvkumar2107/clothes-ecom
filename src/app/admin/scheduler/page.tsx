'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { ArrowLeft, Clock, Calendar, Play, Pause, Trash2, Edit, Plus, Timer } from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface ScheduledDrop {
  id: string;
  name: string;
  slug: string;
  heroImage: string | null;
  launchAt: string | null;
  status: 'draft' | 'scheduled' | 'live' | 'ended';
  productCount: number;
  waitlistCount: number;
  createdAt: string;
}

export default function DropSchedulerPage() {
  const [drops, setDrops] = useState<ScheduledDrop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiGet<{ data: ScheduledDrop[] }>('/api/admin/collections?type=drop');
        setDrops(result.data || []);
      } catch {
        // Fallback empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statusColors: Record<string, string> = {
    draft: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    scheduled: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    live: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    ended: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between pb-6 border-b border-zinc-800/80">
        <div className="flex items-center gap-4">
          <Link href="/admin/dashboard" className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Drop Scheduler</h1>
            <p className="text-xs text-zinc-400 mt-1">Schedule collection drops with countdown auto-publish.</p>
          </div>
        </div>
        <Link
          href="/admin/collections/new"
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
        >
          <Plus className="w-4 h-4" /> New Drop
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : drops.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <Timer className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
          <p className="text-lg">No drops scheduled yet.</p>
          <p className="text-sm mt-2">Create a collection with kind "drop" to schedule a launch.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {drops.map((drop) => (
            <div key={drop.id} className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 shadow-2xl flex items-center gap-5">
              {drop.heroImage ? (
                <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0">
                  <SmartImage src={drop.heroImage} alt="" fill className="object-cover" sizes="80px" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-lg bg-zinc-800 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-sm font-semibold text-zinc-100 truncate">{drop.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${statusColors[drop.status]}`}>
                    {drop.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  <span>{drop.productCount} products</span>
                  <span>{drop.waitlistCount} on waitlist</span>
                  {drop.launchAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(drop.launchAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/admin/collections/${drop.id}/edit`}
                  className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded transition-colors"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
