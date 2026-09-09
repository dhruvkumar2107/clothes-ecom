import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { OrderActionDetails } from '@/components/admin/OrderActionDetails';
import { ArrowLeft, User, MapPin, CreditCard, RotateCcw, Package } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      items: {
        include: {
          product: { select: { slug: true } },
        },
      },
      refunds: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!order) {
    notFound();
  }

  let shippingAddress: any = {};
  try {
    shippingAddress = JSON.parse(order.shippingAddressJson);
  } catch {
    shippingAddress = { line1: order.shippingAddressJson };
  }

  const totalRefundedPaise = order.refunds.reduce((acc, r) => acc + r.amount, 0);

  const statusColors: Record<string, string> = {
    pending: 'bg-[#D4A853]/10 text-[#9C7C4E] border border-[#D4A853]/20',
    confirmed: 'bg-blue-50 text-blue-600 border border-blue-200',
    processing: 'bg-purple-50 text-purple-600 border border-purple-200',
    packed: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
    shipped: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
    delivered: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    cancelled: 'bg-red-50 text-red-600 border border-red-200',
    returned: 'bg-orange-50 text-orange-600 border border-orange-200',
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back Link */}
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1.5 text-[#7A7468] hover:text-[#9C7C4E] text-[12px] font-medium transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Orders
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-[#0A0A0A] font-mono" style={{ fontFamily: "'Playfair Display', serif" }}>
              Order #{order.orderNumber}
            </h1>
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold tracking-wider ${statusColors[order.status] || 'bg-gray-50 text-gray-600'}`}>
              {order.status}
            </span>
          </div>
          <p className="text-[12px] text-[#7A7468] mt-1">
            Placed on {new Date(order.placedAt).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Action Details */}
      <OrderActionDetails
        orderId={order.id}
        orderNumber={order.orderNumber}
        currentStatus={order.status}
        paymentStatus={order.paymentStatus}
        grandTotalPaise={order.grandTotal}
        totalRefundedPaise={totalRefundedPaise}
      />

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Purchased Items */}
          <div className="bg-white rounded-xl border border-[#E8E5DE] p-5">
            <h2 className="text-[13px] font-semibold text-[#0A0A0A] flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-[#9C7C4E]" /> Purchased Items
            </h2>

            <div className="divide-y divide-[#F3F1ED]">
              {order.items.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-12 rounded-md overflow-hidden bg-[#F3F1ED] shrink-0">
                      <SmartImage
                        src={item.imageUrl || '/images/product-linen-shirt.webp'}
                        alt={item.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div>
                      <span className="font-medium text-[#0A0A0A] block text-[12px]">{item.name}</span>
                      <div className="text-[10px] text-[#9E9789] flex items-center gap-1.5 mt-0.5">
                        <span>{item.size}</span>
                        <span className="text-[#E8E5DE]">|</span>
                        <span>{item.color}</span>
                        <span className="text-[#E8E5DE]">|</span>
                        <span className="font-mono">{item.sku}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-semibold text-[#0A0A0A] block text-[12px]">{formatMoney(item.lineTotal)}</span>
                    <span className="text-[10px] text-[#9E9789]">
                      {item.qty} x {formatMoney(item.unitPrice)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Refund History */}
          {order.refunds.length > 0 && (
            <div className="bg-white rounded-xl border border-purple-200 p-5">
              <h2 className="text-[13px] font-semibold text-purple-700 flex items-center gap-2 mb-4">
                <RotateCcw className="w-4 h-4" /> Refund History
              </h2>

              <div className="space-y-3">
                {order.refunds.map((refund) => (
                  <div key={refund.id} className="bg-purple-50 p-3 rounded-lg border border-purple-200 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-purple-800 block text-[12px]">
                        Refund of {formatMoney(refund.amount)}
                      </span>
                      <span className="text-[11px] text-purple-600 block mt-0.5">
                        Reason: {refund.reason || 'Admin refund'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="uppercase px-2 py-0.5 rounded bg-purple-100 border border-purple-200 text-[10px] font-semibold text-purple-700">
                        {refund.mode}
                      </span>
                      <span className="mt-1 block text-[10px] text-[#9E9789]">
                        {new Date(refund.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-xl border border-[#E8E5DE] p-5">
            <h2 className="text-[11px] font-semibold text-[#7A7468] uppercase tracking-wider flex items-center gap-2 mb-3">
              <User className="w-3.5 h-3.5" /> Customer
            </h2>
            <div className="space-y-1">
              <span className="font-medium text-[#0A0A0A] block text-[13px]">{order.user.name}</span>
              <span className="text-[#7A7468] block text-[12px]">{order.user.email}</span>
              <span className="text-[#7A7468] block text-[12px]">{order.user.phone || 'No phone'}</span>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-xl border border-[#E8E5DE] p-5">
            <h2 className="text-[11px] font-semibold text-[#7A7468] uppercase tracking-wider flex items-center gap-2 mb-3">
              <MapPin className="w-3.5 h-3.5" /> Delivery Address
            </h2>
            <div className="text-[#0A0A0A] space-y-0.5 leading-relaxed text-[12px]">
              <p className="font-medium">{shippingAddress.name || order.user.name}</p>
              <p>{shippingAddress.line1}</p>
              {shippingAddress.line2 && <p>{shippingAddress.line2}</p>}
              <p>
                {shippingAddress.city}, {shippingAddress.state} - {shippingAddress.pincode}
              </p>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-white rounded-xl border border-[#E8E5DE] p-5">
            <h2 className="text-[11px] font-semibold text-[#7A7468] uppercase tracking-wider flex items-center gap-2 mb-3">
              <CreditCard className="w-3.5 h-3.5" /> Financial Summary
            </h2>
            <div className="space-y-2 text-[12px] divide-y divide-[#F3F1ED]">
              <div className="flex justify-between py-1">
                <span className="text-[#7A7468]">Subtotal</span>
                <span className="text-[#0A0A0A]">{formatMoney(order.subtotal)}</span>
              </div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between py-1 text-[#3D6B4D]">
                  <span>Discount</span>
                  <span>-{formatMoney(order.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-[#7A7468]">Shipping</span>
                <span className="text-[#0A0A0A]">{order.shippingTotal === 0 ? 'FREE' : formatMoney(order.shippingTotal)}</span>
              </div>
              <div className="flex justify-between py-1 font-bold text-[14px] text-[#9C7C4E] pt-2">
                <span>Grand Total</span>
                <span>{formatMoney(order.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
