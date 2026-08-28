import type { Metadata } from 'next';
import Link from 'next/link';
import { Store, Package, Truck, Users, Shield, Sparkles, Mail, MapPin } from 'lucide-react';


export const metadata: Metadata = {
  title: 'Wholesale & Stockists | LUMEN&CO',
  description: 'Partner with LUMEN&CO for wholesale, retail, or marketplace. Curated luxury fashion, flexible terms, dedicated support. Based in India, shipping globally.',
  alternates: { canonical: '/wholesale' },
};

const WHOLESALE_MODELS = [
  {
    icon: Store,
    title: 'Traditional Wholesale',
    desc: 'Buy at wholesale rates, hold inventory, sell in your boutique or department store. Minimum order: 50 units per style.',
    features: ['Net 30 terms (post-approval)', 'Free shipping on opening order', 'Marketing asset kit included', 'Dedicated account manager'],
    cta: 'Apply for Wholesale',
  },
  {
    icon: Package,
    title: 'Consignment / Sale-or-Return',
    desc: 'We place inventory in your store. You pay only for what sells. Unsold stock returns to us after 90 days. Lower risk for new partners.',
    features: ['No upfront inventory cost', 'Monthly sell-through reports', 'Auto-replenish on bestsellers', 'Shared markdown protection'],
    cta: 'Discuss Consignment',
  },
  {
    icon: Truck,
    title: 'Marketplace / Drop-ship',
    desc: 'List our catalogue on your platform. We fulfil directly to your customers. Real-time inventory sync via API. No inventory holding.',
    features: ['API / CSV / Shopify integration', 'White-label packaging option', 'Automated order routing', 'Daily inventory feeds'],
    cta: 'Technical Integration',
  },
  {
    icon: Sparkles,
    title: 'Exclusive Capsules',
    desc: 'Co-create a limited capsule collection for your channel. We handle design, development, production. You get 6-month exclusivity.',
    features: ['Custom fabric development', 'Co-branded packaging', 'Joint marketing campaign', 'First refusal on reorders'],
    cta: 'Propose a Capsule',
  },
];

const STOCKISTS = [
  { name: 'Ogaan', cities: ['Delhi', 'Mumbai', 'Bangalore'], type: 'Multi-brand luxury' },
  { name: 'Ensemble', cities: ['Delhi', 'Mumbai'], type: 'Designer multi-brand' },
  { name: 'Aza', cities: ['Mumbai', 'Bangalore', 'Hyderabad'], type: 'Occasion wear' },
  { name: 'Pernia\'s Pop-Up Shop', cities: ['Mumbai', 'Delhi', 'Bangalore'], type: 'Designer e-commerce' },
  { name: 'Tasva (Aditya Birla)', cities: ['Pan-India (50+ stores)'], type: 'Men\'s ethnic premium' },
  { name: 'Jaypore', cities: ['Online + experience centres'], type: 'Curated crafts & fashion' },
];

const REQUIREMENTS = [
  'Registered business with valid GSTIN',
  'Physical retail space or established e-commerce operation',
  'Alignment with our brand positioning (no discounting, no unauthorized marketplaces)',
  'Minimum annual purchase commitment: ₹15L (wholesale) / ₹5L (consignment)',
  'Ability to maintain brand presentation standards (VM guidelines provided)',
  'Willingness to share monthly sell-through data',
];

export default function WholesalePage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-5xl">
        <header className="mb-16 max-w-2xl">
          <p className="u-label text-muted-2 mb-3">Partnerships</p>
          <h1 className="u-display text-3xl lg:text-5xl font-light tracking-tight text-ink mb-5">
            Wholesale & stockists
          </h1>
          <p className="text-ink-3 text-lg leading-relaxed">
            We partner with selective retailers who share our obsession with quality, presentation, and customer experience.
            Four models. Transparent terms. No surprises.
          </p>
        </header>

        {/* Partnership models */}
        <section className="mb-20">
          <h2 className="u-title text-2xl font-semibold text-ink mb-12">Ways to partner</h2>
          <div className="space-y-8">
            {WHOLESALE_MODELS.map((model, i) => (
              <div key={i} className="p-8 rounded-xl border border-line bg-paper-2/40">
                <div className="flex flex-col md:flex-row md:items-start gap-6 mb-6">
                  <div className="w-14 h-14 rounded-lg bg-ink/5 flex items-center justify-center flex-shrink-0">
                    <model.icon className="w-7 h-7 text-ink" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <h3 className="u-display text-xl font-medium text-ink mb-2">{model.title}</h3>
                    <p className="text-ink-2">{model.desc}</p>
                  </div>
                </div>
                <ul className="grid sm:grid-cols-2 gap-3 mb-6">
                  {model.features.map((feature, fi) => (
                    <li key={fi} className="flex items-center gap-2 text-sm text-ink-2">
                      <Shield className="w-4 h-4 text-accent flex-shrink-0" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`mailto:wholesale@lumen.co?subject=${encodeURIComponent(`Partnership Inquiry: ${model.title}`)}&body=${encodeURIComponent(`Hi team,\n\nI'm interested in the ${model.title} model. \n\nBusiness: [Your business name]\nType: [Boutique / Department Store / E-commerce / Marketplace]\nLocation: [City, State]\nGSTIN: [Your GSTIN]\nAnnual revenue: [Range]\nCurrent brands carried: [List]\n\nWhy LUMEN&CO: [Brief]\n\nThanks,\n[Your name]`)}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus"
                >
                  {model.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Current stockists */}
        <section className="mb-20">
          <h2 className="u-title text-2xl font-semibold text-ink mb-12">Where we\'re stocked</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="u-label pb-3 font-medium text-ink">Partner</th>
                  <th className="u-label pb-3 font-medium text-ink">Cities</th>
                  <th className="u-label pb-3 font-medium text-ink">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {STOCKISTS.map((stockist, i) => (
                  <tr key={i} className="hover:bg-paper-2/40 transition-colors">
                    <td className="py-3 font-medium text-ink">{stockist.name}</td>
                    <td className="py-3 text-ink-2">{stockist.cities.join(', ')}</td>
                    <td className="py-3 text-ink-2">{stockist.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-2 mt-4">We\'re selective. 12 stockists across 8 cities. Quality over quantity.</p>
        </section>

        {/* Requirements */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">What we look for</h2>
          <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
            {REQUIREMENTS.map((req, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-lg border border-line bg-paper-2/40">
                <Shield className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-ink-2">{req}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <footer className="pt-8 border-t border-line text-center">
          <p className="text-ink-2 mb-6 max-w-xl mx-auto">
            Ready to start the conversation? Tell us about your business and which model interests you.
          </p>
          <a
            href="mailto:wholesale@lumen.co?subject=Wholesale%20Inquiry&body=Hi%20team,%0A%0ABusiness%20name%3A%20%5B%5D%0AType%3A%20%5BBoutique%20%2F%20Dept%20Store%20%2F%20E-comm%20%2F%20Marketplace%5D%0ALocation%3A%20%5BCity%2C%20State%5D%0AGSTIN%3A%20%5B%5D%0AAnnual%20revenue%3A%20%5BRange%5D%0ACurrent%20brands%3A%20%5BList%5D%0A%0AInterested%20in%3A%20%5BWholesale%20%2F%20Consignment%20%2F%20Dropship%20%2F%20Capsule%5D%0A%0AWhy%20LUMEN%26CO%3A%20%5BBrief%5D%0A%0AThanks%2C%0A%5BYour%20name%5D"
            className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus"
          >
            <Mail className="w-4 h-4" aria-hidden="true" />
            Start a Partnership Conversation
          </a>
        </footer>
      </div>
    </div>
  );
}