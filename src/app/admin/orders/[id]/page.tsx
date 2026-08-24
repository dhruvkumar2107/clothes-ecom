import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { PrismaClient } from '@prisma/client';
import { formatMoney } from '@/lib/money';
import { OrderActionDetails } from '@/components/admin/OrderActionDetails';
import { ArrowLeft, User, MapPin, CreditCard, RotateCcw, Package } from 'lucide-react';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
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

  return (
    <div className="space-y-8 max-w-5xl mx-auto text-xs text-zinc-300">
      <div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-amber-400 font-medium mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Orders
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide font-mono">
                Order #{order.orderNumber}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded text-[10px] uppercase font-semibold tracking-wider ${
                  order.status === 'delivered'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : order.status === 'cancelled'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {order.status}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Placed on {new Date(order.placedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <OrderActionDetails
        orderId={order.id}
        orderNumber={order.orderNumber}
        currentStatus={order.status}
        paymentStatus={order.paymentStatus}
        grandTotalPaise={order.grandTotal}
        totalRefundedPaise={totalRefundedPaise}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-400" /> Purchased Items
            </h2>

            <div className="divide-y divide-zinc-800/60">
              {order.items.map((item) => (
                <div key={item.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="relative w-12 h-14 rounded-md overflow-hidden bg-zinc-800 border border-zinc-700/60 shrink-0">
                      <Image
                        src={item.imageUrl || 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=400&q=80'}
                        alt={item.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-100 block text-sm">{item.name}</span>
                      <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5 font-mono">
                        <span>Size: {item.size}</span>
                        <span>•</span>
                        <span>Color: {item.color}</span>
                        <span>•</span>
                        <span>SKU: {item.sku}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <span className="font-semibold text-zinc-100 block">{formatMoney(item.lineTotal)}</span>
                    <span className="text-[10px] text-zinc-400">
                      {item.qty} × {formatMoney(item.unitPrice)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {order.refunds.length > 0 && (
            <div className="bg-purple-950/20 border border-purple-800/40 rounded-xl p-6 space-y-4">
              <h2 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-400" /> Processed Refund History
              </h2>

              <div className="space-y-3">
                {order.refunds.map((refund) => (
                  <div key={refund.id} className="bg-purple-900/30 p-3.5 rounded-lg border border-purple-800/30 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-purple-200 block font-mono">
                        Refund of {formatMoney(refund.amount)}
                      </span>
                      <span className="text-[11px] text-purple-400 block mt-0.5">
                        Reason: {refund.reason || 'Admin refund'}
                      </span>
                    </div>
                    <div className="text-right font-mono text-[10px] text-purple-300">
                      <span className="uppercase px-2 py-0.5 rounded bg-purple-800/40 border border-purple-700/50 block font-sans font-semibold">
                        {refund.mode}
                      </span>
                      <span className="mt-1 block text-zinc-400">
                        {new Date(refund.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-3">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-amber-400" /> Customer Information
            </h2>
            <div className="space-y-1">
              <span className="font-semibold text-zinc-100 block text-sm">{order.user.name}</span>
              <span className="text-zinc-400 block font-mono">{order.user.email}</span>
              <span className="text-zinc-400 block font-mono">{order.user.phone || 'No phone recorded'}</span>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-3">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-amber-400" /> Delivery Address
            </h2>
            <div className="text-zinc-300 space-y-1 leading-relaxed">
              <p className="font-semibold">{shippingAddress.name || order.user.name}</p>
              <p>{shippingAddress.line1}</p>
              {shippingAddress.line2 && <p>{shippingAddress.line2}</p>}
              <p>
                {shippingAddress.city}, {shippingAddress.state} - {shippingAddress.pincode}
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-3 font-mono">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-sans flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Financial Summary
            </h2>
            <div className="space-y-2 text-xs divide-y divide-zinc-800/60 pt-1">
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Subtotal:</span>
                <span>{formatMoney(order.subtotal)}</span>
              </div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between py-1 text-emerald-400">
                  <span>Discount:</span>
                  <span>-{formatMoney(order.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-zinc-400">Shipping:</span>
                <span>{order.shippingTotal === 0 ? 'FREE' : formatMoney(order.shippingTotal)}</span>
              </div>
              <div className="flex justify-between py-1 font-bold text-sm text-amber-300 pt-2">
                <span>Grand Total:</span>
                <span>{formatMoney(order.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
