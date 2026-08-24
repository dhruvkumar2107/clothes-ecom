import { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Privacy Policy | LUMEN&CO',
  description: 'How LUMEN&CO collects, uses, and protects your personal data.',
};

export default function PrivacyPage() {
  const lastUpdated = 'August 24, 2026';

  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-3xl">
        <header className="mb-12 text-center">
          <h1 className="u-display text-3xl lg:text-4xl font-light tracking-tight text-ink mb-4">Privacy Policy</h1>
          <p className="u-label text-zinc-500">Last updated: {lastUpdated}</p>
        </header>

        <article className="prose prose-zinc prose-lg max-w-none text-zinc-700 leading-relaxed">
          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">1. Data Controller</h2>
            <p>LUMEN&CO ("we", "us", "our") is the data controller for personal data processed through our platform. Contact: <a href="mailto:privacy@lumen.co" className="text-amber-600 hover:underline">privacy@lumen.co</a></p>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">2. Data We Collect</h2>
            <h3 className="u-label text-lg font-medium text-ink mb-2">Account Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
              <li>Name, email address, phone number</li>
              <li>Encrypted password hash (we never see your plaintext password)</li>
              <li>Shipping/billing addresses</li>
            </ul>
            <h3 className="u-label text-lg font-medium text-ink mb-2">Order & Transaction Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
              <li>Order history, items purchased, amounts</li>
              <li>Payment method tokens (via Razorpay/Stripe — we do not store full card numbers)</li>
              <li>Refund and return records</li>
            </ul>
            <h3 className="u-label text-lg font-medium text-ink mb-2">Automated Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
              <li>IP address, browser type, device information</li>
              <li>Pages visited, referral source, time spent</li>
              <li>Cookies and similar tracking technologies (see Cookie Policy below)</li>
            </ul>
            <h3 className="u-label text-lg font-medium text-ink mb-2">Referral & Wallet Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
              <li>Referral code usage, commission earnings, wallet balance</li>
              <li>Bank account details for payouts (encrypted, verified via penny-drop)</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">3. Legal Basis for Processing</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Contract performance:</strong> Processing orders, payments, shipping</li>
              <li><strong>Legitimate interest:</strong> Fraud prevention, analytics, service improvement</li>
              <li><strong>Consent:</strong> Marketing communications, cookies (where required)</li>
              <li><strong>Legal obligation:</strong> Tax records, regulatory compliance</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">4. How We Use Your Data</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Fulfill and manage your orders</li>
              <li>Process payments and prevent fraud</li>
              <li>Communicate order updates, shipping notifications</li>
              <li>Administer referral program and wallet</li>
              <li>Improve our platform and personalize your experience</li>
              <li>Comply with legal and regulatory requirements</li>
              <li>Send marketing emails (only with your consent)</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">5. Data Sharing</h2>
            <p>We share data only with:</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li><strong>Payment processors:</strong> Razorpay, Stripe (for payment processing)</li>
              <li><strong>Shipping partners:</strong> Shiprocket, Delhivery (for delivery)</li>
              <li><strong>SMS/Email providers:</strong> Twilio, MSG91, Nodemailer (for notifications)</li>
              <li><strong>Bank verification:</strong> Decentro, Cashfree (for penny-drop verification)</li>
              <li><strong>Legal authorities:</strong> When required by law</li>
            </ul>
            <p>We do not sell your personal data to third parties.</p>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">6. Data Retention</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Account data: Retained while account is active, plus 7 years after closure for tax/legal compliance</li>
              <li>Order data: 7 years from order date (tax law requirement)</li>
              <li>Marketing data: Until you unsubscribe or 2 years of inactivity</li>
              <li>Analytics/cookies: As per cookie consent (max 13 months)</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">7. Your Rights (Under Indian DPDP Act & GDPR)</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate data</li>
              <li><strong>Erasure:</strong> Request deletion (subject to legal retention requirements)</li>
              <li><strong>Portability:</strong> Receive your data in a structured format</li>
              <li><strong>Restriction:</strong> Limit processing in certain circumstances</li>
              <li><strong>Objection:</strong> Object to direct marketing and profiling</li>
              <li><strong>Withdraw consent:</strong> At any time for consent-based processing</li>
            </ul>
            <p>To exercise these rights, email <a href="mailto:privacy@lumen.co" className="text-amber-600 hover:underline">privacy@lumen.co</a>.</p>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">8. Cookies & Tracking</h2>
            <p>We use cookies for:</p>
            <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
              <li><strong>Essential:</strong> Session management, cart, security (cannot be disabled)</li>
              <li><strong>Analytics:</strong> GA4 for usage statistics (with consent)</li>
              <li><strong>Marketing:</strong> Personalized ads (with consent)</li>
            </ul>
            <p>Manage preferences via the cookie banner or browser settings.</p>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">9. Security</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>HTTPS/TLS encryption for all data in transit</li>
              <li>Passwords hashed with bcrypt (cost factor 12)</li>
              <li>JWT tokens for session management (HttpOnly, Secure, SameSite)</li>
              <li>Database encryption at rest for sensitive fields</li>
              <li>Regular security audits and dependency scanning</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">10. International Transfers</h2>
            <p>Data may be processed outside India by our subprocessors (e.g., AWS, Vercel). We ensure adequate safeguards via Standard Contractual Clauses or equivalent mechanisms.</p>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">11. Children's Privacy</h2>
            <p>Our Platform is not directed to children under 18. We do not knowingly collect data from minors. If you believe we have, contact us for immediate deletion.</p>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">12. Changes to This Policy</h2>
            <p>We may update this policy. Material changes will be communicated via email or platform notification. Continued use constitutes acceptance.</p>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">13. Contact Us</h2>
            <p>Data Protection Officer: <a href="mailto:dpo@lumen.co" className="text-amber-600 hover:underline">dpo@lumen.co</a></p>
            <p>Postal: LUMEN&CO, 123 Fashion Street, Bangalore, KA 560001, India</p>
          </section>
        </article>

        <footer className="mt-16 pt-8 border-t border-line text-center text-sm text-zinc-500">
          <p>&copy; {new Date().getFullYear()} LUMEN&CO. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}