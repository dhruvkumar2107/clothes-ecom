'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, RotateCcw, TrendingUp, Package } from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface ReturnReason {
  reason: string;
  count: number;
  percentage: number;
  avgRefundAmount: number;
}

interface ReturnTrend {
  month: string;
  returns: number;
  exchanges: number;
  rate: number;
}

export default function ReturnAnalyticsPage() {
  const [reasons, setReasons] = useState<ReturnReason[]>([]);
  const [trends, setTrends] = useState<ReturnTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiGet<{ reasons: ReturnReason[]; trends: ReturnTrend[] }>('/api/admin/analytics?type=returns');
        setReasons(result.reasons || []);
        setTrends(result.trends || []);
      } catch {
        // Fallback empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 pb-6 border-b border-zinc-800/80">
        <Link href="/admin/dashboard" className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Return & Exchange Analytics</h1>
          <p className="text-xs text-zinc-400 mt-1">Why customers return items and exchange patterns over time.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Return Reasons */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-4">
              <RotateCcw className="w-4 h-4 text-amber-400" /> Return Reasons
            </h2>
            {reasons.length === 0 ? (
              <p className="text-zinc-500 text-sm py-8 text-center">No return data yet</p>
            ) : (
              <div className="space-y-3">
                {reasons.map((r) => (
                  <div key={r.reason} className="flex items-center gap-3">
                    <span className="text-sm text-zinc-200 flex-1 capitalize">{r.reason}</span>
                    <span className="text-xs text-zinc-400 font-mono">{r.count}</span>
                    <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${r.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-amber-400 w-12 text-right">{r.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Return Trends */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-amber-400" /> Monthly Trends
            </h2>
            {trends.length === 0 ? (
              <p className="text-zinc-500 text-sm py-8 text-center">No trend data yet</p>
            ) : (
              <div className="space-y-3">
                {trends.map((t) => (
                  <div key={t.month} className="flex items-center gap-3 text-xs">
                    <span className="text-zinc-400 w-16 font-mono">{t.month}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-rose-400 font-mono w-8">{t.returns}</span>
                      <div className="flex-1 h-4 bg-zinc-800 rounded overflow-hidden flex">
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${(t.returns / Math.max(t.returns + t.exchanges, 1)) * 100}%` }}
                        />
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${(t.exchanges / Math.max(t.returns + t.exchanges, 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-blue-400 font-mono w-8">{t.exchanges}</span>
                    </div>
                    <span className="text-zinc-400 font-mono w-12 text-right">{t.rate.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 mt-4 text-[10px] text-zinc-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-rose-500" /> Returns</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500" /> Exchanges</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
