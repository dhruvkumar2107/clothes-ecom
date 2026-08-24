'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/money';
import { RotateCcw, Truck, Check, Loader2, DollarSign, X } from 'lucide-react';

interface OrderActionProps {
  orderId: string;
  orderNumber: string;
  currentStatus: string;
  paymentStatus: string;
  grandTotalPaise: number;
  totalRefundedPaise: number;
}

export function OrderActionDetails({
  orderId,
  orderNumber,
  currentStatus,
  paymentStatus,
  grandTotalPaise,
  totalRefundedPaise,
}: OrderActionProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState(
    ((grandTotalPaise - totalRefundedPaise) / 100).toString()
  );
  const [refundMode, setRefundMode] = useState('wallet');
  const [refundReason, setRefundReason] = useState('Customer return / exchange adjustment');
  const [processingRefund, setProcessingRefund] = useState(false);
  const [refundError, setRefundError] = useState('');

  const remainingRefundablePaise = grandTotalPaise - totalRefundedPaise;

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingRefund(true);
    setRefundError('');

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: refundAmount,
          reason: refundReason,
          mode: refundMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process refund.');

      setShowRefundModal(false);
      router.refresh();
    } catch (err: any) {
      setRefundError(err.message || 'Error executing refund.');
    } finally {
      setProcessingRefund(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs text-zinc-400 block font-medium">Update Fulfillment Status</span>
          <div className="flex items-center gap-3 mt-1.5">
            <select
              value={status}
              disabled={updatingStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:border-amber-500/60 focus:outline-none"
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {updatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
          </div>
        </div>

        {remainingRefundablePaise > 0 && (
          <button
            type="button"
            onClick={() => setShowRefundModal(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-zinc-100 px-4 py-2 rounded-lg text-xs font-semibold shadow-lg shadow-purple-500/10 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Issue Order Refund
          </button>
        )}
      </div>

      {showRefundModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-6 relative shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">Process Order Refund</h3>
                  <p className="text-[11px] text-zinc-400">Order #{orderNumber}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="text-zinc-400 hover:text-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {refundError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {refundError}
              </div>
            )}

            <form onSubmit={handleProcessRefund} className="space-y-4 text-xs text-zinc-300">
              <div className="bg-zinc-900/60 p-3 rounded-lg border border-zinc-800/60 flex items-center justify-between font-mono">
                <span className="text-zinc-400 text-[11px]">Max Refundable Amount:</span>
                <span className="text-amber-300 font-bold">{formatMoney(remainingRefundablePaise)}</span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Refund Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={(remainingRefundablePaise / 100).toString()}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono focus:border-purple-500/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Refund Method</label>
                <select
                  value={refundMode}
                  onChange={(e) => setRefundMode(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:border-purple-500/60 focus:outline-none"
                >
                  <option value="wallet">Customer Store Wallet Balance (Instant)</option>
                  <option value="source">Original Payment Gateway Source</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Refund Reason / Audit Note</label>
                <textarea
                  rows={2}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 focus:border-purple-500/60 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingRefund}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-semibold shadow-md"
                >
                  {processingRefund && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm & Process Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
