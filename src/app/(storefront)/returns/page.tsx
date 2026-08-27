import type { Metadata } from 'next';
import Link from 'next/link';
import { RotateCcw, Truck, Clock, CheckCircle, XCircle, Package, MessageCircle, ChevronDown } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Returns & Exchanges | LUMEN&CO',
  description: '14-day hassle-free returns and exchanges. Free pickup on first return per order. Start a return from your account.',
  alternates: { canonical: '/returns' },
};

const STEPS = [
  {
    number: '01',
    title: 'Start the return',
    desc: 'Go to your account, select the order, and click "Return/Exchange". Choose items, reason, and whether you want a refund or exchange.',
  },
  {
    number: '02',
    title: 'Pack it up',
    desc: 'Place items in the original packaging with all tags attached. Include the return slip we email you. No printer? Write the return number on a piece of paper inside the box.',
  },
  {
    number: '03',
    title: 'We pick it up',
    desc: 'Our courier collects from your doorstep within 2-3 business days. You\'ll get a pickup confirmation with the AWB number to track.',
  },
  {
    number: '04',
    title: 'Get your refund',
    desc: 'Once received and inspected (2-3 days), refunds process within 24 hours. Original payment method: 3-7 days. Wallet: instant.',
  },
];

const POLICIES = [
  {
    icon: CheckCircle,
    title: '14-day window',
    desc: 'Returns accepted within 14 days of delivery. The clock starts when the courier marks it delivered.',
  },
  {
    icon: CheckCircle,
    title: 'Free first return',
    desc: 'The first return or exchange per order is free. Subsequent returns from the same order incur a ₹99 pickup fee.',
  },
  {
    icon: CheckCircle,
    title: 'Condition requirement',
    desc: 'Items must be unworn, unwashed, with all original tags and labels attached. Packaging should be intact where possible.',
  },
  {
    icon: XCircle,
    title: 'Non-returnable items',
    desc: 'Underwear, swimwear, innerwear, personalized/monogrammed items, and items marked final sale cannot be returned for hygiene reasons.',
  },
  {
    icon: CheckCircle,
    title: 'Exchanges available',
    desc: 'Swap for a different size or colour (subject to stock). If unavailable, we\'ll issue a refund instead.',
  },
  {
    icon: CheckCircle,
    title: 'Refund to wallet option',
    desc: 'Choose instant wallet credit instead of waiting for the bank refund. Wallet balance can be used on your next order or withdrawn to your bank.',
  },
];

const FAQS = [
  {
    q: 'What if I received a damaged or wrong item?',
    a: 'We\'re sorry! Start a return and select "Damaged" or "Wrong item sent" as the reason. We\'ll cover the return shipping and prioritize your replacement/refund. Photos help us resolve it faster — you can upload them when initiating the return.',
  },
  {
    q: 'Can I return a COD order?',
    a: 'Yes. Refunds for COD orders go to your LUMEN&CO wallet by default (instant), or you can request a bank transfer during the return process. Bank transfers take 3-5 business days.',
  },
  {
    q: 'Do I need the original packaging?',
    a: 'We strongly prefer it — it protects the item in transit. If you don\'t have it, use any sturdy box or polybag. Just ensure the item is well-protected and the return slip is inside.',
  },
  {
    q: 'How long do I have to hand over the package after scheduling?',
    a: 'The courier will attempt pickup within 2-3 business days. If you miss them, they\'ll try once more the next day. After two failed attempts, the return request is cancelled and you\'ll need to start a new one.',
  },
  {
    q: 'Can I exchange for a different product entirely?',
    a: 'Exchanges are only for the same product in a different size/colour. For a different product, please return for a refund and place a new order.',
  },
  {
    q: 'What if my return is rejected?',
    a: 'If items show signs of wear, washing, missing tags, or are non-returnable categories, we\'ll notify you with photos. You can choose to have them shipped back (₹99) or donated. We never discard without asking.',
  },
];

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-4xl">
        <header className="mb-14 max-w-2xl">
          <p className="u-label text-muted-2 mb-3">Policy</p>
          <h1 className="u-display text-3xl lg:text-5xl font-light tracking-tight text-ink mb-5">
            Returns & exchanges
          </h1>
          <p className="text-ink-3 text-lg leading-relaxed">
            Changed your mind? Didn\'t fit? We make it easy — 14 days, free pickup on the first return, and you choose refund or exchange.
          </p>
        </header>

        {/* Quick start */}
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-6 md:p-8 mb-16">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="u-display text-xl md:text-2xl font-medium text-ink mb-1">Ready to start a return?</h2>
              <p className="text-ink-2">Have your order number ready. It takes about 2 minutes.</p>
            </div>
            <Link href="/account/orders" className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus whitespace-nowrap">
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Start a Return
            </Link>
          </div>
        </div>

        {/* How it works */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">How it works</h2>
          <div className="space-y-6">
            {STEPS.map((step) => (
              <div key={step.number} className="flex gap-4 md:gap-6">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-lg">
                  {step.number}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="u-title text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="text-ink-2 mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Policies */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">What you need to know</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {POLICIES.map((policy, i) => (
              <div
                key={i}
                className={`p-5 rounded-lg border flex gap-4 ${
                  policy.icon === XCircle
                    ? 'border-danger/30 bg-danger/5'
                    : 'border-line bg-paper-2/40'
                }`}
              >
                <policy.icon
                  className={`w-5 h-5 flex-shrink-0 mt-0.5 ${policy.icon === XCircle ? 'text-danger' : 'text-accent'}`}
                  aria-hidden="true"
                />
                <div>
                  <h3 className="u-label font-semibold text-ink mb-1">{policy.title}</h3>
                  <p className="text-sm text-ink-2 leading-relaxed">{policy.desc}</p>
                </div>
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

        {/* Contact */}
        <footer className="pt-8 border-t border-line text-center">
          <p className="text-ink-2 leading-relaxed mb-4">
            Need help with a specific return? Our team reads every message.
          </p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus">
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            Contact Support
          </Link>
        </footer>
      </div>
    </div>
  );
}