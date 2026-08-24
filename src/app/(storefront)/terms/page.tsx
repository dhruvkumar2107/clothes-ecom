import { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Terms of Service | LUMEN&CO',
  description: 'Terms and conditions governing the use of LUMEN&CO platform and services.',
};

export default function TermsPage() {
  const lastUpdated = 'August 24, 2026';

  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-3xl">
        <header className="mb-12 text-center">
          <h1 className="u-display text-3xl lg:text-4xl font-light tracking-tight text-ink mb-4">Terms of Service</h1>
          <p className="u-label text-zinc-500">Last updated: {lastUpdated}</p>
        </header>

        <article className="prose prose-zinc prose-lg max-w-none text-zinc-700 leading-relaxed">
          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">1. Acceptance of Terms</h2>
            <p>By accessing and using LUMEN&CO ("the Platform", "we", "us", "our"), you ("the User", "you") agree to be bound by these Terms of Service ("Terms"). If you do not agree with any part of these Terms, you must not use the Platform.</p>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">2. Account Registration</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>You must be at least 18 years old to create an account.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You must provide accurate, current, and complete information during registration.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">3. Orders and Payments</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>All orders are subject to acceptance and availability.</li>
              <li>Prices are listed in Indian Rupees (₹) and include applicable taxes unless stated otherwise.</li>
              <li>Payment is processed via secure third-party payment gateways (Razorpay, Stripe).</li>
              <li>We do not store full card details on our servers.</li>
              <li>Order confirmation is sent via email/SMS upon successful payment.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">4. Shipping and Delivery</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>We ship across India via trusted courier partners.</li>
              <li>Estimated delivery timelines are provided at checkout and are approximate.</li>
              <li>Risk of loss transfers to you upon delivery to the shipping address.</li>
              <li>Free shipping may be offered above a minimum order value as specified.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">5. Returns and Refunds</h2>
            <p>Our <Link href="/refund-policy" className="text-amber-600 hover:underline">Return & Refund Policy</Link> governs all returns, exchanges, and refunds. Please review it before making a purchase.</p>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">6. Intellectual Property</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>All content, designs, logos, and trademarks on the Platform are owned by or licensed to LUMEN&CO.</li>
              <li>You may not reproduce, distribute, or create derivative works without written permission.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">7. Referral Program</h2>
            <p>Participation in our referral program is governed by the <Link href="/referral-terms" className="text-amber-600 hover:underline">Referral Program Terms & Conditions</Link>.</p>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, LUMEN&CO shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform.</p>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">9. Governing Law</h2>
            <p>These Terms shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Bangalore, Karnataka.</p>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">10. Changes to Terms</h2>
            <p>We may update these Terms from time to time. Continued use of the Platform after changes constitutes acceptance of the new Terms.</p>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">11. Contact Us</h2>
            <p>For questions about these Terms, contact us at <a href="mailto:legal@lumen.co" className="text-amber-600 hover:underline">legal@lumen.co</a>.</p>
          </section>
        </article>

        <footer className="mt-16 pt-8 border-t border-line text-center text-sm text-zinc-500">
          <p>&copy; {new Date().getFullYear()} LUMEN&CO. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}