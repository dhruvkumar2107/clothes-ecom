import { Metadata } from 'next';
import Link from 'next/link';


export const metadata: Metadata = {
  title: 'Return & Refund Policy | LUMEN&CO',
  description: 'Our return and refund policy governing returns, exchanges, and refunds for purchases made on LUMEN&CO.',
};

export default function RefundPolicyPage() {
  const lastUpdated = 'August 24, 2026';

  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-3xl">
        <header className="mb-12 text-center">
          <h1 className="u-display text-3xl lg:text-4xl font-light tracking-tight text-ink mb-4">Return & Refund Policy</h1>
          <p className="u-label text-zinc-500">Last updated: {lastUpdated}</p>
        </header>

        <article className="prose prose-zinc prose-lg max-w-none text-zinc-700 leading-relaxed">
          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">1. Eligibility</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Returns are accepted within 14 days of delivery date.</li>
              <li>Items must be unused, unwashed, and in their original condition with all tags attached.</li>
              <li>Original packaging must be included where applicable.</li>
              <li>Personalized or customized items are final sale and cannot be returned.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">2. Return Process</h2>
            <ol className="list-decimal list-inside space-y-3 ml-4">
              <li>Contact customer support at <a href="mailto:support@lumen.co" className="text-amber-600 hover:underline">support@lumen.co</a> with your order number.</li>
              <li>Our team will review your request and provide a return authorization (RA) number within 2 business days.</li>
              <li>Pack the item securely in its original packaging.</li>
              <li>Ship the item to the address provided in your return authorization email. Shipping costs are non-refundable unless the return is due to our error.</li>
              <li>Include the RA number outside the package for easy identification.</li>
            </ol>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">3. Refund Amounts</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Refunds will be processed to the original payment method used for purchase.</li>
              <li>The refund amount will exclude the original shipping cost unless the return is due to a defective or incorrect item.</li>
              <li>Refunds typically take 5-10 business days to appear in your account after we receive and inspect the returned item.</li>
              <li>If you paid via Razorpay/Stripe, the refund may appear as a credit on your card statement.</li>
              <li>COD orders: Refunds will be issued to your wallet or original payment method within 7 business days.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">4. Non-Refundable Items</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Personalized or monogrammed items.</li>
              <li>Intimate wear and swimwear with removed hygiene seals.</li>
              <li>Final sale items marked as such on the product page.</li>
              <li>Gift cards and gift vouchers.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">5. Exchanges</h2>
            <p>You may exchange an item for a different size or color within 14 days of delivery, subject to availability.</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Exchange requests follow the same process as returns.</li>
              <li>If the exchange item has a different price, you will be charged the difference or issued a refund for the excess.</li>
              <li>Only one exchange per item is allowed.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">6. Defective or Incorrect Items</h2>
            <p>If you receive a defective, damaged, or incorrect item, please inspect your order upon delivery and contact us immediately at <a href="mailto:support@lumen.co" className="text-amber-600 hover:underline">support@lumen.co</a>.</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>We will cover the return shipping cost for defective or incorrect items.</li>
              <li>A full refund or replacement will be provided at our discretion.</li>
              <li>Please provide photos of the defect, damage, or incorrect item for faster processing.</li>
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="u-title text-xl font-semibold text-ink mb-4">7. Contact Us</h2>
            <p>For questions about this policy, contact us at <a href="mailto:legal@lumen.co" className="text-amber-600 hover:underline">legal@lumen.co</a>.</p>
          </section>
        </article>

        <footer className="mt-16 pt-8 border-t border-line text-center text-sm text-zinc-500">
          <p>&copy; {new Date().getFullYear()} LUMEN&CO. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}