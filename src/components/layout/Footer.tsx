import Link from 'next/link';
import { NewsletterForm } from '@/components/marketing/NewsletterForm';
import { Instagram, Facebook, Twitter, Youtube } from 'lucide-react';

const FOOTER_LINKS = {
  shop: [
    { label: 'All Products', href: '/products' },
    { label: 'New Arrivals', href: '/products?new=true' },
    { label: 'Bestsellers', href: '/products?featured=true' },
    { label: 'Collections', href: '/collections' },
    { label: 'Sale', href: '/products?sale=true' },
    { label: 'Gift Cards', href: '/gift-cards' },
  ],
  help: [
    { label: 'Contact Us', href: '/contact' },
    { label: 'FAQs', href: '/faq' },
    { label: 'Shipping Info', href: '/shipping' },
    { label: 'Returns & Exchanges', href: '/returns' },
    { label: 'Size Guide', href: '/size-guide' },
    { label: 'Track Order', href: '/track' },
  ],
  company: [
    { label: 'Our Story', href: '/about' },
    { label: 'Journal', href: '/journal' },
    { label: 'Sustainability', href: '/sustainability' },
    { label: 'Careers', href: '/careers' },
    { label: 'Press', href: '/press' },
  ],
  legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Shipping Policy', href: '/shipping' },
    { label: 'Refund Policy', href: '/refund-policy' },
  ],
};

const SOCIAL_LINKS = [
  { icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
  { icon: Facebook, href: 'https://facebook.com', label: 'Facebook' },
  { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
  { icon: Youtube, href: 'https://youtube.com', label: 'YouTube' },
];

export function Footer() {
  return (
    <footer className="bg-ink text-paper" role="contentinfo">
      {/* Trust Bar */}
      <div className="border-b border-white/10">
        <div className="u-container py-8 md:py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { label: 'Free Shipping', desc: 'On orders above ₹2,999' },
              { label: 'Easy Returns', desc: '14-day hassle-free returns' },
              { label: 'Secure Payment', desc: '100% secure checkout' },
              { label: 'Customer Care', desc: 'Dedicated support team' },
            ].map((item) => (
              <div key={item.label} className="text-center md:text-left">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-paper/90">{item.label}</p>
                <p className="text-xs text-paper/50 mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="u-container py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-8 md:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4">
            <Link href="/" className="inline-block u-focus" aria-label="LUMEN&CO Home">
              <span className="u-display text-2xl tracking-[-0.02em]">LUMEN&CO</span>
            </Link>
            <p className="text-sm text-paper/50 mt-4 max-w-xs leading-relaxed">
              Future-facing luxury fashion. Engineered fabrics, sculptural silhouettes, and limited drops — shipped across India.
            </p>

            {/* Social Links */}
            <div className="flex gap-3 mt-6">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-paper/50 hover:text-paper hover:border-paper/30 transition-all u-focus"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="u-label text-paper/70 mb-4">Shop</h3>
            <nav aria-label="Shop links">
              <ul className="space-y-2.5">
                {FOOTER_LINKS.shop.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-paper/50 hover:text-paper transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="col-span-1 md:col-span-2">
            <h3 className="u-label text-paper/70 mb-4">Help</h3>
            <nav aria-label="Help links">
              <ul className="space-y-2.5">
                {FOOTER_LINKS.help.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-paper/50 hover:text-paper transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="col-span-1 md:col-span-2">
            <h3 className="u-label text-paper/70 mb-4">About</h3>
            <nav aria-label="About links">
              <ul className="space-y-2.5">
                {FOOTER_LINKS.company.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-paper/50 hover:text-paper transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Newsletter Column */}
          <div className="col-span-2 md:col-span-2">
            <h3 className="u-label text-paper/70 mb-4">Newsletter</h3>
            <p className="text-sm text-paper/50 mb-4">
              Early access to drops and exclusive previews.
            </p>
            <NewsletterForm id="footer-email" source="footer" variant="dark" className="w-full" />
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="u-container py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs text-paper/40">
              <span>&copy; {new Date().getFullYear()} LUMEN&CO</span>
              {FOOTER_LINKS.legal.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-paper/70 transition-colors">
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs text-paper/40">
              <span>Made in India</span>
              <span className="w-px h-3 bg-white/15" />
              <span>INR</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
