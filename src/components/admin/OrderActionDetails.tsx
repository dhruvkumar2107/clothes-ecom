'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@/lib/money';
import { RotateCcw, Truck, Check, Loader2, X } from 'lucide-react';

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
      <div className="bg-white rounded-xl border border-[#E8E5DE] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] text-[#7A7468] block font-medium mb-1.5">Fulfillment Status</span>
          <div className="flex items-center gap-3">
            <select
              value={status}
              disabled={updatingStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg px-3 py-1.5 text-[12px] text-[#0A0A0A] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors"
            >
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {updatingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9C7C4E]" />}
          </div>
        </div>

        {remainingRefundablePaise > 0 && (
          <button
            type="button"
            onClick={() => setShowRefundModal(true)}
            className="flex items-center gap-1.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white px-4 py-2 rounded-lg text-[12px] font-medium transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Process Refund
          </button>
        )}
      </div>

      {showRefundModal && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E5DE] rounded-xl w-full max-w-lg p-6 space-y-5 relative shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#E8E5DE]">
              <div>
                <h3 className="text-[13px] font-semibold text-[#0A0A0A]">Process Refund</h3>
                <p className="text-[11px] text-[#7A7468]">Order #{orderNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="p-1.5 text-[#9E9789] hover:text-[#0A0A0A] rounded-md hover:bg-[#F3F1ED] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {refundError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[12px]">
                {refundError}
              </div>
            )}

            <form onSubmit={handleProcessRefund} className="space-y-4 text-[12px]">
              <div className="bg-[#FAF9F7] p-3 rounded-lg border border-[#E8E5DE] flex items-center justify-between">
                <span className="text-[#7A7468] text-[11px]">Max Refundable</span>
                <span className="font-semibold text-[#9C7C4E]">{formatMoney(remainingRefundablePaise)}</span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#7A7468] mb-1">Amount (INR) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={(remainingRefundablePaise / 100).toString()}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg px-3 py-2 text-[#0A0A0A] font-mono text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#7A7468] mb-1">Method</label>
                <select
                  value={refundMode}
                  onChange={(e) => setRefundMode(e.target.value)}
                  className="w-full bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg px-3 py-2 text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors"
                >
                  <option value="wallet">Store Wallet (Instant)</option>
                  <option value="source">Original Payment Source</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#7A7468] mb-1">Reason</label>
                <textarea
                  rows={2}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg px-3 py-2 text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors resize-y"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8E5DE]">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="px-4 py-2 rounded-lg border border-[#E8E5DE] text-[#7A7468] hover:bg-[#F3F1ED] text-[12px] font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingRefund}
                  className="flex items-center gap-1.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-[12px] font-medium transition-colors"
                >
                  {processingRefund && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
