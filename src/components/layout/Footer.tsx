import Link from 'next/link';
import { NewsletterForm } from '@/components/marketing/NewsletterForm';
import { Facebook, Instagram, Twitter, Youtube, Mail, Truck, Shield, RotateCcw, Headphones } from 'lucide-react';

const FOOTER_LINKS = {
  shop: [
    { label: 'All Products', href: '/products' },
    { label: 'New Arrivals', href: '/products?new=true' },
    { label: 'Bestsellers', href: '/products?featured=true' },
    { label: 'Collections', href: '/collections' },
    { label: 'Sale', href: '/products?sale=true' },
  ],
  help: [
    { label: 'Contact Us', href: '/contact' },
    { label: 'FAQs', href: '/faq' },
    { label: 'Shipping Info', href: '/shipping' },
    { label: 'Returns & Exchanges', href: '/returns' },
    { label: 'Size Guide', href: '/size-guide' },
  ],
  company: [
    { label: 'About Us', href: '/about' },
    { label: 'Sustainability', href: '/sustainability' },
    { label: 'Careers', href: '/careers' },
    { label: 'Press', href: '/press' },
    { label: 'Wholesale', href: '/wholesale' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/cookies' },
    { label: 'Accessibility', href: '/accessibility' },
  ],
};

const SOCIAL_LINKS = [
  { icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
  { icon: Facebook, href: 'https://facebook.com', label: 'Facebook' },
  { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
  { icon: Youtube, href: 'https://youtube.com', label: 'YouTube' },
];

const TRUST_BADGES = [
  { icon: Truck, title: 'Free Shipping', desc: 'On orders above ₹2,999' },
  { icon: Shield, title: 'Secure Payment', desc: '100% secure checkout' },
  { icon: RotateCcw, title: 'Easy Returns', desc: '14-day return policy' },
  { icon: Headphones, title: '24/7 Support', desc: 'Dedicated customer care' },
];

export function Footer() {
  return (
    <footer className="bg-ink text-paper border-t border-ink-2" role="contentinfo">
      <div className="u-container py-16 md:py-24">
        {/* Trust Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-12 pb-12 border-b border-ink-3">
          {TRUST_BADGES.map((badge, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-ink-3 flex items-center justify-center flex-shrink-0">
                <badge.icon className="w-5 h-5 text-accent" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-sm">{badge.title}</p>
                <p className="text-muted-2 text-xs mt-0.5">{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Main Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <h3 className="u-label mb-4">Shop</h3>
            <nav aria-label="Shop links">
              <ul className="space-y-3">
                {FOOTER_LINKS.shop.map((link, i) => (
                  <li key={i}>
                    <Link href={link.href} className="text-sm text-paper/70 hover:text-accent transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div>
            <h3 className="u-label mb-4">Help</h3>
            <nav aria-label="Help links">
              <ul className="space-y-3">
                {FOOTER_LINKS.help.map((link, i) => (
                  <li key={i}>
                    <Link href={link.href} className="text-sm text-paper/70 hover:text-accent transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div>
            <h3 className="u-label mb-4">Company</h3>
            <nav aria-label="Company links">
              <ul className="space-y-3">
                {FOOTER_LINKS.company.map((link, i) => (
                  <li key={i}>
                    <Link href={link.href} className="text-sm text-paper/70 hover:text-accent transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div>
            <h3 className="u-label mb-4">Legal</h3>
            <nav aria-label="Legal links">
              <ul className="space-y-3">
                {FOOTER_LINKS.legal.map((link, i) => (
                  <li key={i}>
                    <Link href={link.href} className="text-sm text-paper/70 hover:text-accent transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        {/* Newsletter & Social */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="md:col-span-2">
            <h3 className="u-label mb-4">Join the LUMEN&CO Collective</h3>
            <p className="text-paper/70 text-sm mb-4 max-w-md">
              Early access to drops, exclusive previews, and styling inspiration — delivered weekly.
            </p>
            <NewsletterForm id="footer-email" source="footer" variant="dark" className="max-w-sm" />
            <p className="text-xs text-muted-2 mt-3">By subscribing you agree to our Privacy Policy.</p>
          </div>

          <div>
            <h3 className="u-label mb-4">Follow Us</h3>
            <div className="flex gap-3">
              {SOCIAL_LINKS.map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg bg-ink-3 flex items-center justify-center text-paper/70 hover:text-accent hover:bg-ink-2 transition-all u-focus"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* App Links */}
        <div className="flex flex-wrap gap-3 mb-12">
          <a href="#" className="flex items-center gap-2 px-4 py-2 bg-ink-3 border border-ink-2 rounded-md text-sm text-paper/70 hover:text-accent transition-colors">
            <Mail className="w-4 h-4" aria-hidden="true" />
            <span>Download on the App Store</span>
          </a>
          <a href="#" className="flex items-center gap-2 px-4 py-2 bg-ink-3 border border-ink-2 rounded-md text-sm text-paper/70 hover:text-accent transition-colors">
            <Mail className="w-4 h-4" aria-hidden="true" />
            <span>Get it on Google Play</span>
          </a>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-ink-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-2">
              © {new Date().getFullYear()} LUMEN&CO. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-2">
              <span>Made in India 🇮🇳</span>
              <span>₹ INR</span>
              <span>English</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}