import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, Leaf, Users, Award, Truck, Heart } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'About LUMEN&CO',
  description: 'Future-facing luxury fashion. Engineered fabrics, sculptural silhouettes, and limited drops — designed in India, shipped worldwide.',
  alternates: { canonical: '/about' },
};

const VALUES = [
  {
    icon: Sparkles,
    title: 'Engineered, not just designed',
    desc: 'Every piece starts with the fabric. We develop proprietary blends — weightless, breathable, shape-retaining — then build the garment around them.',
  },
  {
    icon: Leaf,
    title: 'Made to last',
    desc: 'No planned obsolescence. Reinforced seams, colorfast dyes, fabrics that don\'t pill or sag. If it doesn\'t look new after 50 washes, we didn\'t do our job.',
  },
  {
    icon: Users,
    title: 'Human-scale production',
    desc: 'Small batches. Fair wages. Safe conditions. We know every maker by name. No sweatshops, no shortcuts, no greenwashing.',
  },
  {
    icon: Award,
    title: 'Limited by design',
    desc: 'Each drop is a closed set. Once it\'s gone, it\'s gone — no restocks, no markdowns to clear inventory. This respects early buyers and eliminates waste.',
  },
];

const TIMELINE = [
  { year: '2021', title: 'Founded', desc: 'Started in a Bangalore garage with 3 fabrics and a conviction: luxury doesn\'t need weight.' },
  { year: '2022', title: 'First collection', desc: 'Launched the AIR series — shirts at 89g. Sold out in 72 hours. Proved the market wanted weightless luxury.' },
  { year: '2023', title: 'Fabric lab', desc: 'Built in-house textile R&D. Developed 12 proprietary blends. Filed 3 patents on moisture management and thermal regulation.' },
  { year: '2024', title: 'National rollout', desc: 'Expanded to 19,000+ pincodes. COD verification system cut RTO by 67%. 100k+ orders shipped.' },
  { year: '2025', title: 'Circular program', desc: 'Launched take-back & upcycle. Old LUMEN pieces become new fabric. Closed the loop on our first collection.' },
];

const TEAM = [
  { name: 'Arjun Mehta', role: 'Founder & Creative Director', bio: 'Ex-Ralph Lauren, NIFT Delhi. Obsessed with fabric hand-feel.' },
  { name: 'Priya Nair', role: 'Head of Textile Engineering', bio: 'PhD in Polymer Science, IIT Bombay. Invented our AIR-weave.' },
  { name: 'Rohit Shah', role: 'Operations & Supply Chain', bio: 'Scaled D2C logistics at a unicorn. Built our 48-hr dispatch promise.' },
  { name: 'Sneha Iyer', role: 'Community & Brand', bio: 'Grew a fashion community to 200k. Believes clothing is conversation.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24">
        {/* Hero */}
        <section className="max-w-3xl mb-24">
          <p className="u-label text-accent mb-4">LUMEN&CO</p>
          <h1 className="u-display text-4xl md:text-6xl lg:text-7xl font-light tracking-tight text-ink leading-[1.02] mb-8">
            Light as couture
          </h1>
          <p className="text-ink-3 text-lg md:text-xl leading-relaxed max-w-2xl">
            We make clothes that disappear on the body. Engineered fabrics. Sculptural silhouettes.
            Limited drops. Designed in Bangalore, made in India, shipped across the country.
          </p>
        </section>

        {/* Philosophy */}
        <section className="mb-24">
          <h2 className="u-display text-3xl md:text-4xl font-light text-ink mb-12 max-w-2xl">
            What we believe
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {VALUES.map((value, i) => (
              <div key={i} className="p-6 rounded-xl border border-line bg-paper-2/40">
                <value.icon className="w-8 h-8 text-accent mb-4" aria-hidden="true" />
                <h3 className="u-title text-lg font-semibold text-ink mb-2">{value.title}</h3>
                <p className="text-ink-2 leading-relaxed">{value.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Journey */}
        <section className="mb-24">
          <h2 className="u-title text-2xl font-semibold text-ink mb-12">The journey so far</h2>
          <div className="space-y-8 max-w-2xl">
            {TIMELINE.map((item, i) => (
              <div key={i} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-ink text-paper flex items-center justify-center font-bold text-sm">
                    {item.year}
                  </div>
                  {i < TIMELINE.length - 1 && <div className="w-1 h-24 bg-line mt-4" aria-hidden="true" />}
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="u-label font-semibold text-ink">{item.title}</h3>
                  <p className="text-ink-2 mt-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Team */}
        <section className="mb-24">
          <h2 className="u-title text-2xl font-semibold text-ink mb-12">The people behind the pieces</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {TEAM.map((member, i) => (
              <div key={i} className="text-center">
                <div className="w-28 h-28 mx-auto mb-4 rounded-full bg-ink-2 flex items-center justify-center text-ink font-medium text-lg">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <h3 className="u-title text-base font-semibold text-ink mb-1">{member.name}</h3>
                <p className="u-label text-accent text-sm mb-2">{member.role}</p>
                <p className="text-sm text-ink-2">{member.bio}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <footer className="text-center pt-12 border-t border-line">
          <p className="text-ink-2 mb-6 max-w-xl mx-auto">
            Want to know more? Read our sustainability commitments, see open roles, or get in touch.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/sustainability" className="px-6 py-3 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus">
              Our Impact
            </Link>
            <Link href="/careers" className="px-6 py-3 border border-line text-ink font-medium rounded-md hover:bg-paper-2 transition-colors u-focus">
              Join Us
            </Link>
            <Link href="/contact" className="px-6 py-3 border border-line text-ink font-medium rounded-md hover:bg-paper-2 transition-colors u-focus">
              Get in Touch
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}