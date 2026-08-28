import type { Metadata } from 'next';
import Link from 'next/link';
import { Cookie, Shield, Database, Eye, Globe, Settings } from 'lucide-react';


export const metadata: Metadata = {
  title: 'Cookie Policy | LUMEN&CO',
  description: 'How we use cookies and similar technologies on lumenandco.com. Essential, analytics, marketing, and preference cookies explained.',
  alternates: { canonical: '/cookies' },
};

const COOKIE_CATEGORIES = [
  {
    icon: Shield,
    title: 'Essential (Always Active)',
    desc: 'Required for the website to function. Cannot be switched off.',
    cookies: [
      { name: 'session', purpose: 'Keeps you logged in during your visit', duration: 'Session' },
      { name: 'cart', purpose: 'Remembers items in your shopping bag', duration: '30 days' },
      { name: 'csrf_token', purpose: 'Prevents cross-site request forgery', duration: 'Session' },
      { name: 'cookie_consent', purpose: 'Remembers your cookie preferences', duration: '1 year' },
      { name: 'locale', purpose: 'Stores language and currency preference', duration: '1 year' },
    ],
  },
  {
    icon: Database,
    title: 'Analytics',
    desc: 'Help us understand how visitors use the site so we can improve it.',
    cookies: [
      { name: '_ga', purpose: 'Google Analytics — distinguishes users', duration: '2 years' },
      { name: '_ga_*', purpose: 'Google Analytics 4 — session tracking', duration: '2 years' },
      { name: 'clarity', purpose: 'Microsoft Clarity — heatmaps, session recordings (anonymized)', duration: '1 year' },
    ],
  },
  {
    icon: Globe,
    title: 'Marketing & Advertising',
    desc: 'Used to show relevant ads on other platforms and measure campaign performance.',
    cookies: [
      { name: '_fbp', purpose: 'Meta Pixel — delivers ads on Facebook/Instagram', duration: '3 months' },
      { name: '_gcl_au', purpose: 'Google Ads — conversion tracking', duration: '3 months' },
      { name: 'ttclid', purpose: 'TikTok Ads — attribution', duration: '30 days' },
    ],
  },
  {
    icon: Eye,
    title: 'Personalization',
    desc: 'Enable enhanced features like recommendations and tailored content.',
    cookies: [
      { name: 'recently_viewed', purpose: 'Shows products you\'ve browsed', duration: '30 days' },
      { name: 'wishlist', purpose: 'Persists wishlist across sessions (guest)', duration: '1 year' },
      { name: 'ab_test', purpose: 'A/B test bucket assignment', duration: 'Session' },
    ],
  },
];

const THIRD_PARTY = [
  { name: 'Google Analytics', purpose: 'Traffic analysis, conversion tracking', policy: 'https://policies.google.com/privacy' },
  { name: 'Meta (Facebook/Instagram)', purpose: 'Ad delivery, audience building', policy: 'https://www.facebook.com/policy.php' },
  { name: 'Google Ads', purpose: 'Search & display advertising', policy: 'https://policies.google.com/technologies/ads' },
  { name: 'Microsoft Clarity', purpose: 'Heatmaps, session replay', policy: 'https://clarity.microsoft.com/privacy' },
  { name: 'Shiprocket / Delhivery', purpose: 'Order tracking widgets', policy: 'https://shiprocket.in/privacy-policy' },
  { name: 'Razorpay', purpose: 'Payment processing', policy: 'https://razorpay.com/privacy/' },
];

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-4xl">
        <header className="mb-14 max-w-2xl">
          <p className="u-label text-muted-2 mb-3">Legal</p>
          <h1 className="u-display text-3xl lg:text-5xl font-light tracking-tight text-ink mb-5">
            Cookie policy
          </h1>
          <p className="text-ink-3 text-lg leading-relaxed">
            Last updated: January 2025. This policy explains what cookies are, how we use them,
            and your choices. By using our site, you agree to this policy.
          </p>
        </header>

        {/* What are cookies */}
        <section className="mb-16">
          <h2 className="u-title text-xl font-semibold text-ink mb-4">What are cookies?</h2>
          <p className="text-ink-2 leading-relaxed mb-4">
            Cookies are small text files stored on your device when you visit a website.
            They help the site remember your preferences, keep you logged in, and understand how you use it.
            Some are set by us (first-party), others by services we use (third-party).
          </p>
          <p className="text-ink-2 leading-relaxed">
            You can control cookies through your browser settings or our cookie banner.
            Disabling essential cookies will break core functionality like checkout and login.
          </p>
        </section>

        {/* Categories */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">Cookies we use</h2>
          <div className="space-y-8">
            {COOKIE_CATEGORIES.map((category, i) => (
              <div key={i} className="p-6 rounded-xl border border-line bg-paper-2/40">
                <div className="flex items-center gap-3 mb-4">
                  <category.icon className="w-6 h-6 text-accent" aria-hidden="true" />
                  <h3 className="u-title font-semibold text-ink">{category.title}</h3>
                </div>
                <p className="text-ink-2 mb-4">{category.desc}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="u-label pb-2 font-medium text-ink">Cookie</th>
                        <th className="u-label pb-2 font-medium text-ink">Purpose</th>
                        <th className="u-label pb-2 font-medium text-ink">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/50">
                      {category.cookies.map((cookie, ci) => (
                        <tr key={ci} className="hover:bg-paper-2/40 transition-colors">
                          <td className="py-2 font-mono text-ink">{cookie.name}</td>
                          <td className="py-2 text-ink-2">{cookie.purpose}</td>
                          <td className="py-2 text-ink-2">{cookie.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Third party */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">Third-party services</h2>
          <p className="text-ink-2 mb-6 max-w-xl">
            These providers set their own cookies when you interact with their features on our site.
            We don\'t control their cookies — please refer to their policies.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="u-label pb-2 font-medium text-ink">Provider</th>
                  <th className="u-label pb-2 font-medium text-ink">Purpose</th>
                  <th className="u-label pb-2 font-medium text-ink">Privacy Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {THIRD_PARTY.map((provider, i) => (
                  <tr key={i} className="hover:bg-paper-2/40 transition-colors">
                    <td className="py-2 font-medium text-ink">{provider.name}</td>
                    <td className="py-2 text-ink-2">{provider.purpose}</td>
                    <td className="py-2">
                      <a href={provider.policy} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-sm u-focus">
                        View Policy
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Your choices */}
        <section className="mb-16">
          <h2 className="u-title text-2xl font-semibold text-ink mb-8">Your choices</h2>
          <div className="space-y-6 max-w-2xl">
            <div className="p-5 rounded-xl border border-line bg-paper-2/40">
              <h3 className="u-label font-semibold text-ink mb-3">Cookie banner</h3>
              <p className="text-ink-2 mb-3">
                On your first visit (and when this policy changes), a banner lets you accept all, reject non-essential, or customize.
                Your choice is stored for 1 year.
              </p>
              <button className="px-4 py-2 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus text-sm">
                Reopen Cookie Settings
              </button>
            </div>
            <div className="p-5 rounded-xl border border-line bg-paper-2/40">
              <h3 className="u-label font-semibold text-ink mb-3">Browser controls</h3>
              <p className="text-ink-2 mb-3">
                Most browsers let you block or delete cookies. Links for common browsers:
              </p>
              <div className="flex flex-wrap gap-2">
                <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline u-focus">Chrome</a>
                <a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline u-focus">Firefox</a>
                <a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline u-focus">Safari</a>
                <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline u-focus">Edge</a>
              </div>
            </div>
            <div className="p-5 rounded-xl border border-line bg-paper-2/40">
              <h3 className="u-label font-semibold text-ink mb-3">Opt-out of advertising</h3>
              <p className="text-ink-2 mb-3">
                You can opt out of personalized ads from major platforms:
              </p>
              <div className="flex flex-wrap gap-2">
                <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline u-focus">Google Ads Settings</a>
                <a href="https://www.facebook.com/ads/preferences/" target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline u-focus">Meta Ad Preferences</a>
                <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline u-focus">NAI Opt-Out</a>
                <a href="https://optout.networkadvertising.org/" target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline u-focus">DAA Opt-Out</a>
              </div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <footer className="pt-8 border-t border-line">
          <p className="text-ink-2 mb-4">
            Questions about this policy or our data practices? Contact our Data Protection Officer:
          </p>
          <a href="mailto:dpo@lumen.co" className="text-accent hover:underline">dpo@lumen.co</a>
        </footer>
      </div>
    </div>
  );
}