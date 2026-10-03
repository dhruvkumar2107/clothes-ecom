'use client';

import { useState } from 'react';
import { Package, Truck, CheckCircle2, Search, Loader2, XCircle } from 'lucide-react';

const TRACK_STEPS = [
  { key: 'pending', label: 'Placed', icon: Package },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'packed', label: 'Packed', icon: Package },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

interface TrackingResult {
  orderNumber: string;
  status: string;
  fulfillmentStatus: string;
  placedAt: string;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  items: { name: string; imageUrl: string; qty: number }[];
  shipment: {
    courier: string;
    courierName: string;
    awb: string;
    trackingUrl: string | null;
    status: string;
    events: { status: string; message: string; location: string; occurredAt: string }[];
  } | null;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function OrderTrackingPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TrackingResult | null>(null);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const params = new URLSearchParams({ orderNumber: orderNumber.trim() });
      if (email.trim()) params.set('email', email.trim());
      if (phone.trim()) params.set('phone', phone.trim());

      const res = await fetch(`/api/orders/track?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to track order');
      setResult(data.data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const activeStep = result
    ? TRACK_STEPS.findIndex((s) => s.key === result.status)
    : -1;

  return (
    <div className="u-container py-12 md:py-16 max-w-2xl mx-auto">
      <h1 className="u-display text-3xl md:text-4xl mb-2">Track Your Order</h1>
      <p className="text-muted mb-8">Enter your order number and email or phone to see the latest status.</p>

      <form onSubmit={handleTrack} className="space-y-4 bg-paper-2 border border-line rounded-xl p-6 mb-8">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Order Number *</label>
          <input
            type="text"
            required
            placeholder="e.g. LCO-2026-000123"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-ink text-sm focus:border-accent focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-ink text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Phone</label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2.5 bg-paper border border-line rounded-lg text-ink text-sm focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <p className="text-[11px] text-muted">Provide either email or phone — it must match the one used at checkout.</p>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !orderNumber.trim()}
          className="flex items-center justify-center gap-2 w-full bg-ink text-paper py-2.5 rounded-lg font-medium text-sm hover:bg-ink/80 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Track Order
        </button>
      </form>

      {/* Tracking Result */}
      {result && (
        <div className="space-y-6">
          <div className="bg-paper-2 border border-line rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-serif text-lg font-bold">Order {result.orderNumber}</h2>
                <p className="text-xs text-muted">Placed on {formatDate(result.placedAt)}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                result.status === 'delivered' ? 'bg-success/10 text-success' :
                result.status === 'cancelled' ? 'bg-danger/10 text-danger' :
                'bg-accent/10 text-accent'
              }`}>
                {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
              </span>
            </div>

            {/* Progress Steps */}
            {result.status !== 'cancelled' && (
              <div className="flex items-center gap-1 mb-6">
                {TRACK_STEPS.map((step, i) => {
                  const Icon = step.icon;
                  const isActive = i <= activeStep;
                  const isCurrent = i === activeStep;
                  return (
                    <div key={step.key} className="flex-1 flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                        isActive ? 'bg-accent text-paper' : 'bg-line text-muted'
                      } ${isCurrent ? 'ring-2 ring-accent/30' : ''}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className={`text-[10px] ${isActive ? 'text-ink font-medium' : 'text-muted'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Items */}
            <div className="border-t border-line pt-4">
              <h3 className="text-xs font-medium text-muted mb-3">Items</h3>
              <div className="space-y-2">
                {result.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-muted">{item.qty}×</span>
                    <span className="text-ink">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shipment Tracking */}
          {result.shipment && (
            <div className="bg-paper-2 border border-line rounded-xl p-6">
              <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Shipment — {result.shipment.courierName || result.shipment.courier}
              </h3>
              {result.shipment.awb && (
                <p className="text-xs text-muted mb-2">AWB: <span className="font-mono text-ink">{result.shipment.awb}</span></p>
              )}
              {result.shipment.trackingUrl && (
                <a
                  href={result.shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent underline mb-3 inline-block"
                >
                  Track on courier website →
                </a>
              )}

              {result.shipment.events.length > 0 && (
                <div className="mt-4 space-y-3">
                  {result.shipment.events.map((event, i) => (
                    <div key={i} className="flex gap-3 text-xs">
                      <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-ink font-medium">{event.message || event.status}</p>
                        {event.location && <p className="text-muted">{event.location}</p>}
                        <p className="text-muted text-[10px]">{formatDate(event.occurredAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
