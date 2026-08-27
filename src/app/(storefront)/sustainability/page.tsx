import type { Metadata } from 'next';
import Link from 'next/link';
import { Leaf, Recycle, Truck, Factory, Shield, Award, Clock, RefreshCw } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sustainability | LUMEN&CO',
  description: 'Our commitment to responsible fashion: plastic-neutral packaging, circular take-back, fair wages, and transparent supply chain.',
  alternates: { canonical: '/sustainability' },
};

const PILLARS = [
  {
    icon: Leaf,
    title: 'Materials',
    metrics: ['100% certified fabrics', '12 proprietary blends developed', 'Zero virgin polyester in mainline'],
    desc: 'We only use fabrics we\'ve engineered or certified partners produce. No mystery blends. Every composition is on the product page.',
  },
  {
    icon: Factory,
    title: 'Manufacturing',
    metrics: ['3 partner units, all audited', 'Fair wage certified', 'Zero waste to landfill'],
    desc: 'Small-batch production in Bangalore and Tiruppur. We visit monthly. Workers get above-market wages, healthcare, and skill development.',
  },
  {
    icon: Truck,
    title: 'Logistics',
    metrics: ['Plastic-neutral since 2023', 'Electric last-mile in 6 cities', 'Consolidated shipping by default'],
    desc: 'Every polybag offset via rePurpose Global. 60% of Bangalore/Delhi/Mumbai deliveries are EV. Orders auto-combine to reduce trips.',
  },
  {
    icon: Recycle,
    title: 'Circularity',
    metrics: ['Take-back program live', 'Upcycled collection launched', 'Repair service in Bangalore'],
    desc: 'Send back any LUMEN piece — we sort for resale, upcycle, or fiber recycling. Store credit for every return. Repairs free within 1 year.',
  },
];

const CERTIFICATIONS = [
  { name: 'GOTS', desc: 'Global Organic Textile Standard — our cotton and linen' },
  { name: 'OEKO-TEX 100', desc: 'No harmful substances in any fabric or trim' },
  { name: 'Fair Wear Foundation', desc: 'Living wages and safe conditions at partner units' },
  { name: 'rePurpose Global', desc: 'Plastic-neutral certification for all packaging' },
  { name: 'ISO 14001', desc: 'Environmental management at our fabric lab' },
];

const GOALS = [
  { year: '2025', title: 'Carbon neutral operations', desc: 'Scope 1 & 2 emissions offset via verified projects. Scope 3 measurement complete.' },
  { year: '2026', title: '50% recycled inputs', desc: 'Half of all fabric weight from post-consumer or post-industrial recycled fibers.' },
  { year: '2027', title: 'Full traceability', desc: 'Every thread traced to farm/factory. Blockchain-backed transparency for customers.' },
  { year: '2030', title: 'Net positive', desc: 'More carbon sequestered than emitted. More water restored than used. More waste diverted than created.' },
];

export default function SustainabilityPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-5xl">
        <header className="mb-16 max-w-2xl">
          <p className="u-label text-muted-2 mb-3">Impact</p>
          <h1 className="u-display text-3xl lg:text-5xl font-light tracking-tight text-ink mb-5">
            Responsibility, not marketing
          </h1>
          <p className="text-ink-3 text-lg leading-relaxed">
            We don\'t do sustainability reports. We do the work, measure it, and show you the numbers.
            No net-zero pledges for 2050 — concrete targets for 2025, 2026, 2027.
          </p>
        </header>

        {/* Pillars */}
        <section className="mb-20">
          <h2 className="u-title text-2xl font-semibold text-ink mb-12">Four pillars</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PILLARS.map((pillar, i) => (
              <div key={i} className="p-6 rounded-xl border border-line bg-paper-2/40">
                <pillar.icon className="w-8 h-8 text-accent mb-4" aria-hidden="true" />
                <h3 className="u-title text-lg font-semibold text-ink mb-3">{pillar.title}</h3>
                <p className="text-ink-2 leading-relaxed mb-4">{pillar.desc}</p>
                <ul className="space-y-2">
                  {pillar.metrics.map((metric, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-ink-2">
                      <RefreshCw className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
                      {metric}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Certifications */}
        <section className="mb-20">
          <h2 className="u-title text-2xl font-semibold text-ink mb-12">Third-party verification</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CERTIFICATIONS.map((cert, i) => (
              <div key={i} className="p-5 rounded-lg border border-line bg-paper-2/40">
                <h3 className="u-label font-semibold text-ink mb-1">{cert.name}</h3>
                <p className="text-sm text-ink-2">{cert.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Goals */}
        <section className="mb-20">
          <h2 className="u-title text-2xl font-semibold text-ink mb-12">Public targets</h2>
          <div className="space-y-6 max-w-2xl">
            {GOALS.map((goal, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-xl border border-line bg-paper-2/40">
                <div className="flex-shrink-0 w-16 text-center">
                  <div className="u-display text-2xl font-light text-ink">{goal.year}</div>
                </div>
                <div className="flex-1">
                  <h3 className="u-title font-semibold text-ink">{goal.title}</h3>
                  <p className="text-ink-2 mt-1">{goal.desc}</p>
                </div>
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <Award className="w-5 h-5 text-accent" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Transparency */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">What we\'re still working on</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
            <div className="p-6 rounded-xl border border-line bg-paper-2/40">
              <h3 className="u-title font-semibold text-ink mb-3">Scope 3 emissions</h3>
              <p className="text-ink-2 leading-relaxed">
                We measure but haven\'t fully reduced upstream emissions (fiber production, dyeing, transport).
                2026 target: 30% reduction vs 2024 baseline via recycled fibers and cleaner energy at partner mills.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-line bg-paper-2/40">
              <h3 className="u-title font-semibold text-ink mb-3">Water stewardship</h3>
              <p className="text-ink-2 leading-relaxed">
                Our fabric lab uses closed-loop dyeing, but partner mills vary. We\'re auditing water risk
                across the supply chain and co-investing in ZDHC-compliant effluent treatment where needed.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <footer className="text-center pt-12 border-t border-line">
          <p className="text-ink-2 mb-6 max-w-xl mx-auto">
            Questions about our practices? We publish full data annually. Ask us anything.
          </p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus">
            Ask a Question
          </Link>
        </footer>
      </div>
    </div>
  );
}