'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, Sparkles, BarChart3 } from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface QuizResponse {
  id: string;
  answers: Record<string, string | string[]>;
  createdAt: string;
  userId?: string;
}

interface AggregatedData {
  question: string;
  answers: { value: string; count: number; percentage: number }[];
}

export default function StyleQuizAnalyticsPage() {
  const [responses, setResponses] = useState<QuizResponse[]>([]);
  const [aggregated, setAggregated] = useState<AggregatedData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiGet<{ data: QuizResponse[] }>('/api/admin/analytics?type=style-quiz');
        const data = result.data || [];
        setResponses(data);

        // Aggregate answers
        const questionMap: Record<string, Record<string, number>> = {};
        data.forEach((r) => {
          Object.entries(r.answers).forEach(([q, a]) => {
            if (!questionMap[q]) questionMap[q] = {};
            const values = Array.isArray(a) ? a : [a];
            values.forEach((v) => {
              questionMap[q][v] = (questionMap[q][v] || 0) + 1;
            });
          });
        });

        const agg: AggregatedData[] = Object.entries(questionMap).map(([question, answers]) => {
          const total = Object.values(answers).reduce((a, b) => a + b, 0);
          return {
            question,
            answers: Object.entries(answers)
              .map(([value, count]) => ({ value, count, percentage: total > 0 ? (count / total) * 100 : 0 }))
              .sort((a, b) => b.count - a.count),
          };
        });
        setAggregated(agg);
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
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Style Quiz Analytics</h1>
          <p className="text-xs text-zinc-400 mt-1">What customers actually want — aggregated quiz responses.</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Responses</span>
            <Users className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100 mt-2">{responses.length}</div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Questions Tracked</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100 mt-2">{aggregated.length}</div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Unique Options</span>
            <BarChart3 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100 mt-2">
            {aggregated.reduce((acc, a) => acc + a.answers.length, 0)}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : aggregated.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
          <p className="text-lg">No quiz responses yet.</p>
          <p className="text-sm mt-2">Responses will appear once customers complete the style quiz.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {aggregated.map((q) => (
            <div key={q.question} className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 shadow-2xl">
              <h3 className="text-sm font-semibold text-zinc-100 mb-4 capitalize">
                {q.question.replace(/-/g, ' ')}
              </h3>
              <div className="space-y-3">
                {q.answers.map((a) => (
                  <div key={a.value} className="flex items-center gap-3">
                    <span className="text-sm text-zinc-200 flex-1 capitalize">{a.value.replace(/-/g, ' ')}</span>
                    <span className="text-xs text-zinc-400 font-mono">{a.count}</span>
                    <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all"
                        style={{ width: `${a.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-amber-400 w-12 text-right">{a.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
