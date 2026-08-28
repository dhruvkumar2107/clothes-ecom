import type { Metadata } from 'next';
import Link from 'next/link';
import { Briefcase, Heart, Sparkles, Users, Clock, MapPin, CheckCircle } from 'lucide-react';


export const metadata: Metadata = {
  title: 'Careers | LUMEN&CO',
  description: 'Join a team redefining luxury fashion. Engineering-led, design-driven, impact-obsessed. Based in Bangalore, hiring across India.',
  alternates: { canonical: '/careers' },
};

const BENEFITS = [
  { icon: Heart, title: 'Health & wellness', desc: 'Comprehensive medical for you + family, mental health support, annual wellness stipend.' },
  { icon: Sparkles, title: 'Learning budget', desc: '₹50k/year for courses, conferences, books, certifications — no approval needed under ₹10k.' },
  { icon: Users, title: 'Team retreats', desc: 'Quarterly offsites (we\'ve done Coorg, Goa, Hampi). Annual all-hands with family invite.' },
  { icon: Clock, title: 'Flexible hours', desc: 'Core hours 11–4, rest is yours. Remote-friendly — 2 weeks work-from-anywhere per quarter.' },
  { icon: MapPin, title: 'Bangalore HQ', desc: 'Sunlit studio in Indiranagar. Great coffee, standing desks, fabric library, nap pod.' },
  { icon: CheckCircle, title: 'Equity for all', desc: 'Every full-time team member gets ESOPs. We\'re building something valuable together.' },
];

const OPEN_ROLES = [
  {
    dept: 'Engineering',
    roles: [
      { title: 'Senior Textile Engineer', type: 'Full-time', location: 'Bangalore', desc: 'Develop next-gen performance blends. PhD/Masters in Polymer/Textile Science preferred.' },
      { title: 'Frontend Engineer (React/Next.js)', type: 'Full-time', location: 'Bangalore / Remote', desc: 'Build the storefront, admin, and internal tools. 3+ years React, TypeScript, Tailwind.' },
      { title: 'Backend Engineer (Node/PostgreSQL)', type: 'Full-time', location: 'Bangalore / Remote', desc: 'API, payments, inventory, real-time systems. Prisma, Redis, event-driven architecture.' },
    ],
  },
  {
    dept: 'Design',
    roles: [
      { title: 'Product Designer', type: 'Full-time', location: 'Bangalore', desc: 'End-to-end: research → prototypes → production specs. Fashion/industrial design background.' },
      { title: 'Graphic & Motion Designer', type: 'Full-time', location: 'Bangalore', desc: 'Brand identity, campaigns, lookbooks, social. After Effects + Figma fluent.' },
    ],
  },
  {
    dept: 'Operations',
    roles: [
      { title: 'Supply Chain Manager', type: 'Full-time', location: 'Bangalore', desc: 'Fabric sourcing, production planning, vendor management. 4+ years apparel supply chain.' },
      { title: 'Customer Experience Lead', type: 'Full-time', location: 'Bangalore', desc: 'Support, returns, WhatsApp commerce, retention. Empathy-first, data-driven.' },
    ],
  },
  {
    dept: 'Growth',
    roles: [
      { title: 'Performance Marketing Manager', type: 'Full-time', location: 'Bangalore', desc: 'Meta, Google, YouTube, influencer. ₹1Cr+ monthly budget. Creative-strategic hybrid.' },
      { title: 'Retention & Lifecycle Manager', type: 'Full-time', location: 'Bangalore', desc: 'Email, SMS, WhatsApp, push, loyalty. Braze/Klaviyo experience preferred.' },
    ],
  },
];

const CULTURE = [
  'No meetings Wednesdays — deep work protected',
  'Weekly "Fabric Friday" — touch, test, debate new swatches',
  'Monthly "Customer Day" — everyone does support for 2 hours',
  'Quarterly hack weeks — build anything, ship to staging',
  'Annual "Maker Swap" — spend a week at a partner factory',
  'Transparent salaries — bands published internally',
];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-5xl">
        <header className="mb-16 max-w-2xl">
          <p className="u-label text-muted-2 mb-3">Team</p>
          <h1 className="u-display text-3xl lg:text-5xl font-light tracking-tight text-ink mb-5">
            Build the future of fashion
          </h1>
          <p className="text-ink-3 text-lg leading-relaxed">
            We\'re a small, senior team. No hierarchy, no politics — just high agency people solving hard problems in textiles, tech, and retail.
            Every role has outsized impact. You\'ll ship in weeks, not quarters.
          </p>
        </header>

        {/* Benefits */}
        <section className="mb-20">
          <h2 className="u-title text-2xl font-semibold text-ink mb-12">Why LUMEN&CO</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map((benefit, i) => (
              <div key={i} className="p-6 rounded-xl border border-line bg-paper-2/40">
                <benefit.icon className="w-7 h-7 text-accent mb-3" aria-hidden="true" />
                <h3 className="u-label font-semibold text-ink mb-2">{benefit.title}</h3>
                <p className="text-sm text-ink-2">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Open roles */}
        <section className="mb-20">
          <h2 className="u-title text-2xl font-semibold text-ink mb-12">Open roles</h2>
          {OPEN_ROLES.map((dept, di) => (
            <div key={di} className="mb-12">
              <h3 className="u-label text-accent mb-6">{dept.dept}</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dept.roles.map((role, ri) => (
                  <article
                    key={ri}
                    className="p-6 rounded-xl border border-line bg-paper-2/40 hover:border-accent/50 transition-colors"
                  >
                    <h4 className="u-title font-semibold text-ink mb-2">{role.title}</h4>
                    <div className="flex flex-wrap gap-2 text-xs text-ink-2 mb-3">
                      <span className="px-2 py-1 bg-ink text-paper rounded">{role.type}</span>
                      <span className="px-2 py-1 bg-ink text-paper rounded">{role.location}</span>
                    </div>
                    <p className="text-sm text-ink-2 mb-4">{role.desc}</p>
                    <Link
                      href={`mailto:careers@lumen.co?subject=${encodeURIComponent(`Application: ${role.title}`)}&body=${encodeURIComponent(`Hi team,\n\nI'd love to apply for the ${role.title} role. A bit about me:\n\n[Your background]\n\n[Why LUMEN&CO]\n\n[Portfolio/LinkedIn/GitHub]\n\nThanks,\n[Your name]`)}`}
                      className="inline-flex items-center gap-2 u-label text-accent hover:underline font-medium"
                    >
                      Apply →
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Culture */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">How we work</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl">
            {CULTURE.map((item, i) => (
              <div key={i} className="p-4 rounded-lg border border-line bg-paper-2/40 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-accent flex-shrink-0" aria-hidden="true" />
                <p className="text-sm text-ink-2">{item}</p>
              </div>
            ))}
          </div>
        </section>

        {/* No open role match */}
        <section className="mb-16 p-8 rounded-xl border border-accent/30 bg-accent/5 text-center">
          <h2 className="u-display text-xl md:text-2xl font-light text-ink mb-3">Don\'t see your role?</h2>
          <p className="text-ink-2 mb-6 max-w-md mx-auto">
            We\'re always looking for exceptional people. If you think you\'d add value, tell us what you\'d build.
          </p>
          <Link
            href="mailto:careers@lumen.co?subject=Unsolicited%20Application&body=Hi%20team,%0A%0AI%27d%20love%20to%20work%20with%20you.%20Here%27s%20what%20I%27d%20build%3A%0A%0A%5BYour%20idea%5D%0A%0AMy%20background%3A%20%5Bbrief%5D%0A%0APortfolio%2FLinkedIn%2FGitHub%3A%20%5Blink%5D%0A%0AThanks%2C%0A%5BYour%20name%5D"
            className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus"
          >
            Send an open application
          </Link>
        </section>

        <footer className="text-center pt-8 border-t border-line text-ink-2">
          <p>LUMEN&CO is an equal opportunity employer. We celebrate diversity and are committed to creating an inclusive environment.</p>
        </footer>
      </div>
    </div>
  );
}