'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Package, BarChart3 } from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface SizeAnalytics {
  size: string;
  totalSold: number;
  returnCount: number;
  returnRate: number;
  exchangeCount: number;
  avgRating: number;
}

interface SKUAnalytics {
  productId: string;
  productName: string;
  productSlug: string;
  sizes: SizeAnalytics[];
  totalSold: number;
  totalReturns: number;
}

export default function SizeAnalyticsPage() {
  const [data, setData] = useState<SKUAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiGet<{ data: SKUAnalytics[] }>('/api/admin/analytics?type=size-fit');
        setData(result.data || []);
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
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Size & Fit Analytics</h1>
          <p className="text-xs text-zinc-400 mt-1">Which sizes return most, exchange rates, and fit insights per SKU.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <Package className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
          <p className="text-lg">No size analytics data yet.</p>
          <p className="text-sm mt-2">Data will appear once orders with returns/exchanges are processed.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {data.map((sku) => (
            <div key={sku.productId} className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Link href={`/admin/products/${sku.productId}/edit`} className="text-zinc-100 font-medium hover:text-amber-400 transition-colors">
                    {sku.productName}
                  </Link>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {sku.totalSold} sold · {sku.totalReturns} returns ({sku.totalSold > 0 ? ((sku.totalReturns / sku.totalSold) * 100).toFixed(1) : 0}%)
                  </p>
                </div>
                <BarChart3 className="w-5 h-5 text-zinc-500" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-zinc-300">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-2 px-3 font-medium text-zinc-400 uppercase tracking-wider">Size</th>
                      <th className="text-right py-2 px-3 font-medium text-zinc-400 uppercase tracking-wider">Sold</th>
                      <th className="text-right py-2 px-3 font-medium text-zinc-400 uppercase tracking-wider">Returns</th>
                      <th className="text-right py-2 px-3 font-medium text-zinc-400 uppercase tracking-wider">Return Rate</th>
                      <th className="text-right py-2 px-3 font-medium text-zinc-400 uppercase tracking-wider">Exchanges</th>
                      <th className="text-right py-2 px-3 font-medium text-zinc-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {sku.sizes.map((size) => (
                      <tr key={size.size} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-3 font-mono font-medium text-zinc-100">{size.size}</td>
                        <td className="py-3 px-3 text-right font-mono">{size.totalSold}</td>
                        <td className="py-3 px-3 text-right font-mono text-rose-400">{size.returnCount}</td>
                        <td className="py-3 px-3 text-right font-mono">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            size.returnRate > 20 ? 'bg-rose-500/20 text-rose-400' :
                            size.returnRate > 10 ? 'bg-amber-500/20 text-amber-400' :
                            'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {size.returnRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-blue-400">{size.exchangeCount}</td>
                        <td className="py-3 px-3 text-right">
                          {size.returnRate > 20 ? (
                            <span className="flex items-center gap-1 text-rose-400 justify-end">
                              <TrendingUp className="w-3 h-3" /> High returns
                            </span>
                          ) : size.returnRate < 5 && size.totalSold > 5 ? (
                            <span className="flex items-center gap-1 text-emerald-400 justify-end">
                              <TrendingDown className="w-3 h-3" /> Good fit
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
