import { Metadata } from 'next';
import Link from 'next/link';


export const metadata: Metadata = {
  title: 'Referral Program Terms & Conditions | LUMEN&CO',
  description: 'Terms and conditions governing the LUMEN&CO referral program.',
};

export default function ReferralTermsPage() {
  const lastUpdated = 'August 24, 2026';

  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-3xl">
        <header className="mb-12 text-center">
          <h1 className="u-display text-3xl lg:text-4xl font-light tracking-tight text-ink mb-4">Referral Program Terms & Conditions</h1>
          <p className="u-label text-zinc-500">Last updated: {lastUpdated}</p>
        </header>

        <article className="prose prose-zinc prose-lg max-w-none text-zinc-700 leading-relaxed">
          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">1. Eligibility</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Any registered LUMEN&CO account holder with a verified email address may participate in the referral program.</li>
              <li>Participants must be at least 18 years old and reside in India.</li>
              <li>Employees of LUMEN&CO and their immediate family members are not eligible.</li>
              <li>Accounts found to be fraudulent or using bots will be disqualified.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">2. How It Works</h2>
            <ol className="list-decimal list-inside space-y-3 ml-4">
              <li>Each participant receives a unique referral code upon signing up for the program.</li>
              <li>Share your referral code with friends and family. When someone uses your code to make their first purchase, they receive a welcome discount.</li>
              <li>When your referral's order is delivered and confirmed, you earn a commission on the order value.</li>
              <li>Commission is calculated based on the active referral rules configured for your account.</li>
            </ol>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">3. Commission & Payouts</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Commission rates are determined by the referral rules set by LUMEN&CO (typically 5-15% of order value).</li>
              <li>Commissions are held for 14 days after the referred order is delivered to allow for returns and fraud prevention.</li>
              <li>Once the hold period ends, commissions become eligible for payout.</li>
              <li>Minimum payout threshold is ₹100. Commissions below this amount accumulate until the threshold is met.</li>
              <li>Payouts are processed to your wallet or linked bank account via the payout provider.</li>
              <li>Payouts are processed weekly on Tuesdays.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">4. Fraud & Abuse Prevention</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Self-referrals (using your own code) are strictly prohibited and will result in forfeiture of commissions.</li>
              <li>Circular referrals (where Referral A refers B, B refers C, C refers A) are prohibited.</li>
              <li>Using bots, fake accounts, or incentivized referrals (e.g., paying others to use your code) is forbidden.</li>
              <li>LUMEN&CO reserves the right to flag, block, or ban accounts suspected of fraud.</li>
              <li>Fraud flags are reviewed within 3 business days. Blocked accounts will receive written notice.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">5. Program Modification</h2>
            <p>LUMEN&CO reserves the right to modify these terms at any time. Participants will be notified via email of any material changes.</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Continued participation after changes constitutes acceptance of the new terms.</li>
              <li>LUMEN&CO may discontinue the referral program at any time without prior notice.</li>
              <li>Commissions earned up to the date of program discontinuation will be honored and paid out according to the original terms.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">6. Contact Us</h2>
            <p>For questions about the referral program, email <a href="mailto:referrals@lumen.co" className="text-amber-600 hover:underline">referrals@lumen.co</a>.</p>
          </section>
        </article>

        <footer className="mt-16 pt-8 border-t border-line text-center text-sm text-zinc-500">
          <p>&copy; {new Date().getFullYear()} LUMEN&CO. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}