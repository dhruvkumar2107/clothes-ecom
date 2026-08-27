'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, Palette, BarChart3, Calendar } from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface TrendData {
  color: string;
  count: number;
  percentage: number;
  trend: 'rising' | 'stable' | 'declining';
}

interface StyleData {
  style: string;
  count: number;
  percentage: number;
}

export default function TrendAnalyticsPage() {
  const [colors, setColors] = useState<TrendData[]>([]);
  const [styles, setStyles] = useState<StyleData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiGet<{ colors: TrendData[]; styles: StyleData[] }>('/api/admin/analytics?type=trends');
        setColors(result.colors || []);
        setStyles(result.styles || []);
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
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Seasonal Trend Dashboard</h1>
          <p className="text-xs text-zinc-400 mt-1">What colors, styles, and categories are trending in your store.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Color Trends */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-amber-400" /> Color Trends
            </h2>
            {colors.length === 0 ? (
              <p className="text-zinc-500 text-sm py-8 text-center">No color data yet</p>
            ) : (
              <div className="space-y-3">
                {colors.map((c) => (
                  <div key={c.color} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full border border-zinc-700" style={{ backgroundColor: c.color }} />
                    <span className="text-sm text-zinc-200 flex-1">{c.color}</span>
                    <span className="text-xs text-zinc-400 font-mono">{c.count} sales</span>
                    <span className="text-xs font-mono text-amber-400">{c.percentage.toFixed(1)}%</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                      c.trend === 'rising' ? 'bg-emerald-500/20 text-emerald-400' :
                      c.trend === 'declining' ? 'bg-rose-500/20 text-rose-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      {c.trend === 'rising' ? '↑' : c.trend === 'declining' ? '↓' : '—'} {c.trend}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Style Trends */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 shadow-2xl">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-amber-400" /> Style Trends
            </h2>
            {styles.length === 0 ? (
              <p className="text-zinc-500 text-sm py-8 text-center">No style data yet</p>
            ) : (
              <div className="space-y-3">
                {styles.map((s) => (
                  <div key={s.style} className="flex items-center gap-3">
                    <span className="text-sm text-zinc-200 flex-1 capitalize">{s.style}</span>
                    <span className="text-xs text-zinc-400 font-mono">{s.count} sales</span>
                    <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${s.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-amber-400 w-12 text-right">{s.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
