import type { Metadata } from 'next';
import Link from 'next/link';
import { Image, FileText, Video, Camera, ExternalLink, Download } from 'lucide-react';


export const metadata: Metadata = {
  title: 'Press & Media | LUMEN&CO',
  description: 'Press kit, brand assets, media coverage, and contact for journalists. LUMEN&CO — engineered luxury fashion from India.',
  alternates: { canonical: '/press' },
};

const PRESS_KIT = [
  {
    title: 'Logo & Wordmark',
    desc: 'Primary, secondary, and monochrome variants. SVG + PNG.',
    icon: Image,
    href: '/press/kit/logo.zip',
  },
  {
    title: 'Product Photography',
    desc: 'Hero shots, detail crops, on-model lifestyle. High-res, approved for editorial use.',
    icon: Camera,
    href: '/press/kit/photography.zip',
  },
  {
    title: 'Brand Guidelines',
    desc: 'Typography, color palette, spacing, do\'s and don\'ts. PDF.',
    icon: FileText,
    href: '/press/kit/guidelines.pdf',
  },
  {
    title: 'Video Assets',
    desc: 'Brand film, fabric close-ups, factory walkthrough. ProRes + H.264.',
    icon: Video,
    href: '/press/kit/video.zip',
  },
  {
    title: 'Founder Bios & Headshots',
    desc: 'Arjun Mehta (Founder), Priya Nair (Textile Lead). Long + short bios.',
    icon: FileText,
    href: '/press/kit/bios.pdf',
  },
  {
    title: 'Fact Sheet',
    desc: 'Key metrics, timeline, certifications, sustainability data. Updated quarterly.',
    icon: FileText,
    href: '/press/kit/factsheet.pdf',
  },
];

const COVERAGE = [
  {
    outlet: 'Vogue India',
    date: 'March 2025',
    title: 'The Weightless Wardrobe: How LUMEN&CO Is Redefining Indian Luxury',
    type: 'feature',
    href: 'https://vogue.in/fashion/lumen-co-weightless-luxury',
  },
  {
    outlet: 'Business Standard',
    date: 'January 2025',
    title: 'From Garage to 100k Orders: The LUMEN&CO Story',
    type: 'business',
    href: 'https://business-standard.com/lumen-co-d2c-success',
  },
  {
    outlet: 'YourStory',
    date: 'November 2024',
    title: 'Engineering Fabric Like Software: Inside LUMEN&CO\'s Textile Lab',
    type: 'tech',
    href: 'https://yourstory.com/lumen-co-textile-rd',
  },
  {
    outlet: 'Mint Lounge',
    date: 'September 2024',
    title: 'Why This Bangalore Brand Doesn\'t Do Sales',
    type: 'opinion',
    href: 'https://livemint.com/lumen-co-no-discounts',
  },
  {
    outlet: 'The Hindu BusinessLine',
    date: 'July 2024',
    title: 'Circular Fashion at Scale: LUMEN&CO\'s Take-Back Program',
    type: 'sustainability',
    href: 'https://thehindubusinessline.com/lumen-co-circular',
  },
  {
    outlet: 'Entrepreneur India',
    date: 'May 2024',
    title: 'D2C Playbook: How LUMEN&CO Cracked COD Verification',
    type: 'operations',
    href: 'https://entrepreneurindia.com/lumen-co-cod-rto',
  },
];

const CONTACT_INFO = {
  email: 'press@lumen.co',
  name: 'Sneha Iyer',
  title: 'Head of Brand & Communications',
  phone: '+91 90000 00000',
  responseTime: 'Within 4 business hours',
};

export default function PressPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-5xl">
        <header className="mb-16 max-w-2xl">
          <p className="u-label text-muted-2 mb-3">Media</p>
          <h1 className="u-display text-3xl lg:text-5xl font-light tracking-tight text-ink mb-5">
            Press kit & coverage
          </h1>
          <p className="text-ink-3 text-lg leading-relaxed">
            Everything you need to write about us. High-res assets, verified facts, direct contact.
            We respond fast — usually within 4 hours.
          </p>
        </header>

        {/* Press kit */}
        <section className="mb-20">
          <h2 className="u-title text-2xl font-semibold text-ink mb-12">Press kit</h2>
          <p className="text-ink-2 mb-8 max-w-xl">
            All assets are pre-approved for editorial use. Credit: "LUMEN&CO" or "Courtesy of LUMEN&CO".
            For exclusive access or embargoed materials, email us directly.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRESS_KIT.map((item, i) => (
              <a
                key={i}
                href={item.href}
                className="flex items-center gap-4 p-5 rounded-xl border border-line bg-paper-2/40 hover:border-accent/50 transition-colors u-focus"
                download
              >
                <div className="w-12 h-12 rounded-lg bg-ink/5 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-6 h-6 text-ink" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="u-label font-semibold text-ink truncate">{item.title}</h3>
                  <p className="text-sm text-ink-2">{item.desc}</p>
                </div>
                <Download className="w-5 h-5 text-muted" aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>

        {/* Media coverage */}
        <section className="mb-20">
          <h2 className="u-title text-2xl font-semibold text-ink mb-12">Recent coverage</h2>
          <div className="space-y-4">
            {COVERAGE.map((item, i) => (
              <a
                key={i}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-xl border border-line bg-paper-2/40 hover:border-accent/50 transition-colors u-focus"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="u-label text-accent">{item.outlet}</span>
                    <span className="text-xs text-muted-2">{item.date}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded bg-${item.type === 'feature' ? 'accent' : item.type === 'business' ? 'ink' : item.type === 'tech' ? 'success' : item.type === 'sustainability' ? 'warning' : 'info'}/10 text-${item.type === 'feature' ? 'accent' : item.type === 'business' ? 'ink' : item.type === 'tech' ? 'success' : item.type === 'sustainability' ? 'warning' : 'info'}`}>
                      {item.type}
                    </span>
                  </div>
                  <h3 className="font-semibold text-ink truncate">{item.title}</h3>
                </div>
                <ExternalLink className="w-5 h-5 text-muted flex-shrink-0" aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">Media contact</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="u-label text-ink-3 w-32">Name</span>
                <span className="font-medium text-ink">{CONTACT_INFO.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="u-label text-ink-3 w-32">Title</span>
                <span className="text-ink-2">{CONTACT_INFO.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="u-label text-ink-3 w-32">Email</span>
                <a href={`mailto:${CONTACT_INFO.email}`} className="text-ink hover:text-accent underline underline-offset-2 font-medium">{CONTACT_INFO.email}</a>
              </div>
              <div className="flex items-center gap-3">
                <span className="u-label text-ink-3 w-32">Phone</span>
                <a href={`tel:${CONTACT_INFO.phone}`} className="text-ink hover:text-accent underline underline-offset-2">{CONTACT_INFO.phone}</a>
              </div>
              <div className="flex items-center gap-3">
                <span className="u-label text-ink-3 w-32">Response</span>
                <span className="text-ink-2">{CONTACT_INFO.responseTime}</span>
              </div>
            </div>
            <div className="p-5 rounded-xl border border-line bg-paper-2/40">
              <h3 className="u-label font-semibold text-ink mb-3">Quick pitch? Request a sample?</h3>
              <p className="text-sm text-ink-2 mb-4">
                We love discovering new angles. Loaner program available for stylists and editors.
              </p>
              <a
                href={`mailto:${CONTACT_INFO.email}?subject=Press%20Inquiry&body=Hi%20Sneha,%0A%0A[Your%20outlet%20%26%20angle]%0A%0A[What%20you%27d%20like%20from%20us]%0A%0AThanks%2C%0A[Your%20name]`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus text-sm"
              >
                Email Press Team
              </a>
            </div>
          </div>
        </section>

        {/* Brand assets quick access */}
        <footer className="pt-8 border-t border-line text-center">
          <p className="text-ink-2 mb-4">Need something specific not in the kit?</p>
          <a href={`mailto:${CONTACT_INFO.email}`} className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus">
            Custom Request
          </a>
        </footer>
      </div>
    </div>
  );
}