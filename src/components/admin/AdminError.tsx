'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface AdminErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function AdminError({
  title = 'Something went wrong',
  message = 'Failed to load data. Please try again.',
  onRetry,
}: AdminErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 max-w-md text-center">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-zinc-100 mb-1">{title}</h3>
        <p className="text-sm text-zinc-400 mb-4">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
