import type { Metadata } from 'next';
import Link from 'next/link';
import { Truck, Clock, MapPin, Shield, RotateCcw, CreditCard, CheckCircle, HelpCircle, ChevronDown } from 'lucide-react';

export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Shipping & Delivery | LUMEN&CO',
  description: 'Free shipping on orders above ₹2,999. Standard 4-6 days, Express 2-3 days in select cities. COD available. Track orders in your account.',
  alternates: { canonical: '/shipping' },
};

const SHIPPING_OPTIONS = [
  {
    title: 'Standard Delivery',
    eta: '4–6 business days',
    price: 'Free above ₹2,999<br/>₹99 below ₹2,999',
    coverage: 'All serviceable pincodes in India',
    icon: Truck,
    featured: false,
  },
  {
    title: 'Express Delivery',
    eta: '2–3 business days',
    price: '₹199 (free above ₹4,999)',
    coverage: 'Metro & Tier-1 cities only',
    icon: Clock,
    featured: true,
  },
];

const SERVICEABILITY = [
  {
    icon: MapPin,
    title: 'Check your pincode',
    desc: 'Enter your pincode on any product page or at checkout to see exact delivery dates, COD availability, and express eligibility for your area.',
  },
  {
    icon: Shield,
    title: 'Secure packaging',
    desc: 'Every order ships in tamper-evident, water-resistant packaging. Fragile items get additional protection. We\'re plastic-neutral — packaging is recyclable.',
  },
  {
    icon: RotateCcw,
    title: 'Easy returns',
    desc: '14-day return window from delivery. Free pickup on first return per order. Start from your account — no calls needed.',
  },
];

const TIMELINE = [
  { label: 'Order placed', desc: 'You receive email + SMS confirmation with order number.' },
  { label: 'Payment confirmed', desc: 'Instant for prepaid. COD orders verified via call/WhatsApp before packing.' },
  { label: 'Packed & labelled', desc: 'Quality check passed. AWB generated. You get tracking link via SMS/email.' },
  { label: 'Picked up by courier', desc: 'Courier scans at pickup. Status updates to "In Transit".' },
  { label: 'In transit', desc: 'Real-time tracking on your order page. Typical: 2-4 days depending on distance.' },
  { label: 'Out for delivery', desc: 'Courier partner calls/WhatsApps before attempt. Keep phone handy.' },
  { label: 'Delivered', desc: 'OTP verification for COD/high-value. 14-day return window starts now.' },
];

const COD_INFO = [
  {
    icon: CreditCard,
    title: 'COD availability',
    desc: 'Available in most pincodes for orders up to ₹5,000. Above ₹5,000 requires prepaid or partial prepaid. Check your pincode at checkout.',
  },
  {
    icon: Shield,
    title: 'Verification required',
    desc: 'All COD orders above ₹2,000 require OTP verification (sent via SMS/WhatsApp) before dispatch. This reduces failed deliveries and protects you.',
  },
  {
    icon: HelpCircle,
    title: 'COD handling fee',
    desc: 'A nominal ₹49 COD fee applies to cover courier collection charges. Waived on orders above ₹2,999. Shown clearly at checkout.',
  },
];

const FAQS = [
  {
    q: 'My tracking shows "delivered" but I didn\'t receive it.',
    a: 'Check with neighbors, security, or household members. Couriers sometimes mark delivered a few minutes early. If still missing after 24 hours, contact us from your order page — we\'ll open an investigation with the courier and keep you updated.',
  },
  {
    q: 'Can I schedule delivery for a specific date/time?',
    a: 'Not currently. Couriers deliver during business hours (9 AM–7 PM). For COD, they\'ll call before attempting. If you\'ll be unavailable, you can authorize a neighbor/family member to receive and pay.',
  },
  {
    q: 'What happens if I refuse a COD delivery?',
    a: 'The order returns to us (RTO). Once received, we\'ll cancel and notify you. Refused COD orders may restrict future COD eligibility. Please only order COD if you\'re committed to accepting delivery.',
  },
  {
    q: 'Do you ship to PO Boxes or Army/APO addresses?',
    a: 'No, we need a physical address with a recipient name and phone number for courier delivery. For remote locations, we use India Post which requires a physical address.',
  },
  {
    q: 'My order is stuck at "picked up" for days.',
    a: 'This usually means the courier hasn\'t scanned the next checkpoint. It\'s often still moving. If no update for 3+ business days, contact us — we\'ll follow up with the courier and expedite if needed.',
  },
];

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-4xl">
        <header className="mb-14 max-w-2xl">
          <p className="u-label text-muted-2 mb-3">Delivery</p>
          <h1 className="u-display text-3xl lg:text-5xl font-light tracking-tight text-ink mb-5">
            Shipping & delivery
          </h1>
          <p className="text-ink-3 text-lg leading-relaxed">
            Fast, reliable, and transparent. Every scan is visible in your account — often before the courier\'s own tracking updates.
          </p>
        </header>

        {/* Shipping options */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">Delivery options</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {SHIPPING_OPTIONS.map((option, i) => (
              <div
                key={i}
                className={`relative p-6 rounded-xl border ${
                  option.featured
                    ? 'border-accent bg-accent/5'
                    : 'border-line bg-paper-2/40'
                }`}
              >
                {option.featured && (
                  <span className="absolute -top-3 left-6 px-3 py-1 bg-accent text-paper text-xs font-medium rounded-full">
                    Most Popular
                  </span>
                )}
                <div className="flex items-center gap-4 mb-4">
                  <option.icon className="w-8 h-8 text-accent" aria-hidden="true" />
                  <h3 className="u-title text-lg font-semibold text-ink">{option.title}</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-2">Estimated delivery</span>
                    <span className="font-medium text-ink">{option.eta}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-2">Cost</span>
                    <span className="font-medium text-ink" dangerouslySetInnerHTML={{ __html: option.price }} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-2">Coverage</span>
                    <span className="font-medium text-ink">{option.coverage}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Serviceability */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">At your doorstep</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {SERVICEABILITY.map((item, i) => (
              <div key={i} className="p-5 rounded-lg border border-line bg-paper-2/40">
                <item.icon className="w-6 h-6 text-accent mb-3" aria-hidden="true" />
                <h3 className="u-label font-semibold text-ink mb-1">{item.title}</h3>
                <p className="text-sm text-ink-2 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">What happens after you order</h2>
          <div className="space-y-6">
            {TIMELINE.map((step, i) => (
              <div key={i} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-ink text-paper flex items-center justify-center font-medium text-sm">
                    {i + 1}
                  </div>
                  {i < TIMELINE.length - 1 && <div className="w-1 h-16 bg-line mt-2" aria-hidden="true" />}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="u-label font-semibold text-ink">{step.label}</h3>
                  <p className="text-sm text-ink-2 mt-1">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* COD Info */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">Cash on Delivery</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {COD_INFO.map((item, i) => (
              <div key={i} className="p-5 rounded-lg border border-line bg-paper-2/40">
                <item.icon className="w-6 h-6 text-accent mb-3" aria-hidden="true" />
                <h3 className="u-label font-semibold text-ink mb-1">{item.title}</h3>
                <p className="text-sm text-ink-2 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQs */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">Common questions</h2>
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <details key={i} className="group border border-line rounded-lg bg-paper-2/40">
                <summary className="p-5 flex items-start justify-between gap-4 cursor-pointer list-none">
                  <span className="font-medium text-ink flex-1">{faq.q}</span>
                  <ChevronDown className="w-5 h-5 text-muted flex-shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="px-5 pb-5 pt-0 border-t border-line">
                  <p className="text-ink-2 leading-relaxed">{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Pincode checker CTA */}
        <footer className="pt-8 border-t border-line text-center">
          <p className="text-ink-2 leading-relaxed mb-4">
            Want exact dates for your area?
          </p>
          <Link href="/products" className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus">
            <MapPin className="w-4 h-4" aria-hidden="true" />
            Shop & check delivery
          </Link>
        </footer>
      </div>
    </div>
  );
}