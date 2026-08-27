import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/utils';
import { readJson } from '@/lib/json';
import {
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  MapPin,
  FileText,
  ExternalLink,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order details',
  description: 'Track your order and download the GST invoice.',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

/** The happy path a shipment walks. Cancelled and returned orders skip it. */
const TRACK_STEPS = [
  { key: 'pending', label: 'Placed', icon: Package },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'packed', label: 'Packed', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
] as const;

const STATUS_TONE: Record<string, string> = {
  delivered: 'bg-success/10 text-success',
  cancelled: 'bg-danger/10 text-danger',
  returned: 'bg-info/10 text-info',
};

interface AddressSnapshot {
  name?: string;
  line1?: string;
  line2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
}

function title(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(d: Date) {
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getCustomerSession();
  if (!session) redirect(`/login?redirect=/account/orders/${id}`);

  /**
   * Scope the lookup to the signed-in user rather than filtering after the fetch
   * — an order id in someone else's URL must read as "not found", not as a
   * permission error that confirms the order exists.
   */
  const order = await db.order.findFirst({
    where: { id, userId: session.userId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      fulfillmentStatus: true,
      paymentMethod: true,
      couponCode: true,
      subtotal: true,
      discountTotal: true,
      shippingTotal: true,
      codFee: true,
      taxTotal: true,
      walletApplied: true,
      grandTotal: true,
      amountPaid: true,
      amountDue: true,
      customerNote: true,
      giftWrap: true,
      placedAt: true,
      confirmedAt: true,
      cancelledAt: true,
      cancelReason: true,
      deliveredAt: true,
      returnWindowEndsAt: true,
      shippingAddressJson: true,
      items: {
        select: {
          id: true,
          name: true,
          sku: true,
          size: true,
          color: true,
          imageUrl: true,
          qty: true,
          unitPrice: true,
          lineTotal: true,
          returnedQty: true,
          cancelledQty: true,
          fulfillmentStatus: true,
          product: { select: { slug: true } },
        },
      },
      events: {
        where: { customerVisible: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          location: true,
          createdAt: true,
        },
      },
      shipments: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          courier: true,
          courierName: true,
          awb: true,
          trackingUrl: true,
          status: true,
          shippedAt: true,
          deliveredAt: true,
          events: {
            orderBy: { occurredAt: 'desc' },
            select: { id: true, status: true, message: true, location: true, occurredAt: true },
          },
        },
      },
      invoices: {
        where: { kind: 'tax' },
        orderBy: { issuedAt: 'desc' },
        take: 1,
        select: { id: true, invoiceNumber: true, issuedAt: true, total: true },
      },
      returns: {
        orderBy: { requestedAt: 'desc' },
        select: {
          id: true,
          returnNumber: true,
          kind: true,
          status: true,
          reason: true,
          refundAmount: true,
          requestedAt: true,
        },
      },
    },
  });

  if (!order) notFound();

  const address = readJson<AddressSnapshot>(order.shippingAddressJson, {});
  const invoice = order.invoices[0] ?? null;
  const terminal = order.status === 'cancelled' || order.status === 'returned';
  const activeStep = TRACK_STEPS.findIndex((s) => s.key === order.status);
  const canReturn =
    order.status === 'delivered' &&
    !!order.returnWindowEndsAt &&
    new Date(order.returnWindowEndsAt) > new Date() &&
    order.returns.length === 0;

  const summary: { label: string; value: number; tone?: 'minus' }[] = [
    { label: 'Subtotal', value: order.subtotal },
    ...(order.discountTotal > 0
      ? [{ label: `Discount${order.couponCode ? ` (${order.couponCode})` : ''}`, value: -order.discountTotal, tone: 'minus' as const }]
      : []),
    { label: order.shippingTotal === 0 ? 'Shipping (free)' : 'Shipping', value: order.shippingTotal },
    ...(order.codFee > 0 ? [{ label: 'COD fee', value: order.codFee }] : []),
    { label: 'GST', value: order.taxTotal },
    ...(order.walletApplied > 0
      ? [{ label: 'Wallet applied', value: -order.walletApplied, tone: 'minus' as const }]
      : []),
  ];

  return (
    <div className="py-8 md:py-12">
      <div className="u-container">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 u-label text-ink/40">
            <li>
              <Link href="/account" className="hover:text-accent u-focus">
                Account
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/account/orders" className="hover:text-accent u-focus">
                Orders
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-ink font-mono">{order.orderNumber}</li>
          </ol>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="u-display text-3xl mb-2">
              Order <span className="font-mono">{order.orderNumber}</span>
            </h1>
            <p className="text-muted">
              Placed {formatDate(order.placedAt)} · {order.items.length}{' '}
              {order.items.length === 1 ? 'item' : 'items'} ·{' '}
              {order.paymentMethod ? title(order.paymentMethod) : 'Payment pending'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                STATUS_TONE[order.status] ?? 'bg-warning/10 text-warning'
              }`}
            >
              {title(order.status)}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                order.paymentStatus === 'paid'
                  ? 'bg-success/10 text-success'
                  : 'bg-danger/10 text-danger'
              }`}
            >
              {order.amountDue > 0
                ? `Due ${formatCurrency(order.amountDue)}`
                : title(order.paymentStatus)}
            </span>
          </div>
        </div>

        {/* Progress */}
        {terminal ? (
          <div className="mb-10 rounded-lg border border-line bg-paper p-5 flex items-start gap-3">
            {order.status === 'cancelled' ? (
              <XCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <RotateCcw className="w-5 h-5 text-info shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div>
              <p className="font-medium text-ink">
                {order.status === 'cancelled' ? 'Order cancelled' : 'Order returned'}
                {order.cancelledAt ? ` on ${formatDate(order.cancelledAt)}` : ''}
              </p>
              {order.cancelReason ? (
                <p className="text-sm text-muted mt-1">{order.cancelReason}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <ol className="mb-10 grid grid-cols-5 gap-2" aria-label="Order progress">
            {TRACK_STEPS.map((step, i) => {
              const done = activeStep >= 0 && i <= activeStep;
              const current = i === activeStep;
              return (
                <li key={step.key} className="flex flex-col items-center text-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${
                      done
                        ? 'bg-ink text-paper border-ink'
                        : 'bg-paper text-muted-2 border-line'
                    }`}
                    aria-hidden="true"
                  >
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`u-label mt-2 text-[11px] ${current ? 'text-accent' : done ? 'text-ink' : 'text-muted-2'}`}
                  >
                    {step.label}
                  </span>
                  {current ? <span className="sr-only">(current status)</span> : null}
                </li>
              );
            })}
          </ol>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Items + tracking */}
          <div className="lg:col-span-2 space-y-8">
            <section aria-labelledby="items-title">
              <h2 id="items-title" className="u-label mb-4">
                Items
              </h2>
              <ul className="rounded-lg border border-line bg-paper divide-y divide-line">
                {order.items.map((item) => (
                  <li key={item.id} className="p-4 flex items-start gap-4">
                    {item.imageUrl ? (
                      // Snapshot URLs may point at hosts that have since changed;
                      // a plain img keeps a dead link from failing the render.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="w-16 h-20 rounded object-cover bg-paper-2 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-20 rounded bg-paper-2 shrink-0" aria-hidden="true" />
                    )}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/products/${item.product.slug}`}
                        className="font-medium text-ink hover:text-accent u-focus"
                      >
                        {item.name}
                      </Link>
                      <p className="text-sm text-muted mt-1">
                        {item.size} · {item.color} · Qty {item.qty}
                      </p>
                      <p className="text-xs text-muted-2 mt-1 font-mono">{item.sku}</p>
                      {item.returnedQty > 0 ? (
                        <p className="text-xs text-info mt-1">{item.returnedQty} returned</p>
                      ) : null}
                      {item.cancelledQty > 0 ? (
                        <p className="text-xs text-danger mt-1">{item.cancelledQty} cancelled</p>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium text-ink">{formatCurrency(item.lineTotal)}</p>
                      {item.qty > 1 ? (
                        <p className="text-xs text-muted-2 mt-1">
                          {formatCurrency(item.unitPrice)} each
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {order.shipments.length > 0 ? (
              <section aria-labelledby="shipments-title">
                <h2 id="shipments-title" className="u-label mb-4">
                  Shipments
                </h2>
                <div className="space-y-4">
                  {order.shipments.map((s) => (
                    <div key={s.id} className="rounded-lg border border-line bg-paper p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div>
                          <p className="font-medium text-ink">
                            {s.courierName ?? title(s.courier)}
                          </p>
                          {s.awb ? (
                            <p className="text-sm text-muted font-mono mt-1">AWB {s.awb}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-ink/5 text-ink">
                            {title(s.status)}
                          </span>
                          {s.trackingUrl ? (
                            <a
                              href={s.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-accent hover:underline flex items-center gap-1 u-focus"
                            >
                              Track
                              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>
                      </div>
                      {s.events.length > 0 ? (
                        <ol className="space-y-3 pt-3 border-t border-line">
                          {s.events.map((e) => (
                            <li key={e.id} className="flex gap-3 text-sm">
                              <span className="text-muted-2 shrink-0 w-36">
                                {formatDateTime(e.occurredAt)}
                              </span>
                              <span className="text-ink">
                                {e.message}
                                {e.location ? (
                                  <span className="text-muted"> · {e.location}</span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {order.events.length > 0 ? (
              <section aria-labelledby="timeline-title">
                <h2 id="timeline-title" className="u-label mb-4">
                  Timeline
                </h2>
                <ol className="rounded-lg border border-line bg-paper divide-y divide-line">
                  {order.events.map((e) => (
                    <li key={e.id} className="p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-ink">{e.title}</p>
                        <span className="text-xs text-muted-2">{formatDateTime(e.createdAt)}</span>
                      </div>
                      {e.description ? (
                        <p className="text-sm text-muted mt-1">{e.description}</p>
                      ) : null}
                      {e.location ? (
                        <p className="text-xs text-muted-2 mt-1">{e.location}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {order.returns.length > 0 ? (
              <section aria-labelledby="returns-title">
                <h2 id="returns-title" className="u-label mb-4">
                  Returns &amp; exchanges
                </h2>
                <ul className="rounded-lg border border-line bg-paper divide-y divide-line">
                  {order.returns.map((r) => (
                    <li key={r.id} className="p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-ink font-mono">{r.returnNumber}</p>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-ink/5 text-ink">
                          {title(r.status)}
                        </span>
                      </div>
                      <p className="text-sm text-muted mt-1">
                        {title(r.kind)} · {r.reason}
                      </p>
                      {r.refundAmount > 0 ? (
                        <p className="text-sm text-ink mt-1">
                          Refund {formatCurrency(r.refundAmount)}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-2 mt-1">
                        Requested {formatDate(r.requestedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {/* Summary sidebar */}
          <aside className="space-y-6">
            <section
              className="rounded-lg border border-line bg-paper p-5"
              aria-labelledby="payment-title"
            >
              <h2 id="payment-title" className="u-label mb-4">
                Payment summary
              </h2>
              <dl className="space-y-2 text-sm">
                {summary.map((row) => (
                  <div key={row.label} className="flex justify-between gap-4">
                    <dt className="text-muted">{row.label}</dt>
                    <dd className={row.tone === 'minus' ? 'text-success' : 'text-ink'}>
                      {row.tone === 'minus' ? '−' : ''}
                      {formatCurrency(Math.abs(row.value))}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 pt-3 mt-3 border-t border-line">
                  <dt className="font-semibold text-ink">Total</dt>
                  <dd className="font-semibold text-ink">{formatCurrency(order.grandTotal)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Paid</dt>
                  <dd className="text-ink">{formatCurrency(order.amountPaid)}</dd>
                </div>
                {order.amountDue > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-danger">Due on delivery</dt>
                    <dd className="text-danger font-medium">{formatCurrency(order.amountDue)}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section
              className="rounded-lg border border-line bg-paper p-5"
              aria-labelledby="address-title"
            >
              <h2 id="address-title" className="u-label mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" aria-hidden="true" />
                Delivery address
              </h2>
              <address className="text-sm not-italic text-ink/80 leading-relaxed">
                {address.name ? <span className="block font-medium text-ink">{address.name}</span> : null}
                {address.line1 ? <span className="block">{address.line1}</span> : null}
                {address.line2 ? <span className="block">{address.line2}</span> : null}
                {address.landmark ? <span className="block">{address.landmark}</span> : null}
                <span className="block">
                  {[address.city, address.state, address.pincode].filter(Boolean).join(', ')}
                </span>
                {address.phone ? <span className="block mt-2">{address.phone}</span> : null}
              </address>
            </section>

            {invoice ? (
              <section
                className="rounded-lg border border-line bg-paper p-5"
                aria-labelledby="invoice-title"
              >
                <h2 id="invoice-title" className="u-label mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" aria-hidden="true" />
                  GST invoice
                </h2>
                <p className="text-sm text-muted mb-4 font-mono">{invoice.invoiceNumber}</p>
                <a
                  href={`/api/orders/${order.id}/invoice`}
                  className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-ink text-paper rounded-md text-sm font-medium hover:bg-ink-2 transition-colors u-focus"
                >
                  Download PDF
                </a>
              </section>
            ) : null}

            {order.customerNote ? (
              <section className="rounded-lg border border-line bg-paper p-5">
                <h2 className="u-label mb-3">Your note</h2>
                <p className="text-sm text-ink/80">{order.customerNote}</p>
              </section>
            ) : null}

            {/* There is no self-serve return flow yet, so this points at the policy
                rather than at a route that would 404. */}
            {canReturn ? (
              <Link
                href="/refund-policy"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-md border border-line text-ink text-sm font-medium hover:bg-paper-3 transition-colors u-focus"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Return or exchange this order
              </Link>
            ) : null}

            {order.status === 'delivered' && order.returnWindowEndsAt ? (
              <p className="text-xs text-muted-2 text-center">
                {new Date(order.returnWindowEndsAt) > new Date()
                  ? `Return window closes ${formatDate(order.returnWindowEndsAt)}.`
                  : `Return window closed on ${formatDate(order.returnWindowEndsAt)}.`}
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
