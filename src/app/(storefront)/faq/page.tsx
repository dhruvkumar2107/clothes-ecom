import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/Accordion';


export const metadata: Metadata = {
  title: 'FAQs | LUMEN&CO',
  description: 'Answers to common questions about orders, shipping, returns, sizing, payments and more.',
  alternates: { canonical: '/faq' },
};

const FAQ_CATEGORIES = [
  {
    title: 'Orders & Payments',
    items: [
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit/debit cards (Visa, Mastercard, RuPay, Amex), UPI (PhonePe, Google Pay, Paytm, BHIM), Net Banking (50+ banks), Cash on Delivery (where available), and Wallet balance. EMI options are available on select cards.',
      },
      {
        q: 'Is Cash on Delivery available for my pincode?',
        a: 'COD availability depends on your delivery pincode and order value. Enter your pincode on the product page or at checkout to check. COD orders above ₹5,000 require OTP verification before dispatch.',
      },
      {
        q: 'Can I modify or cancel my order after placing it?',
        a: 'You can cancel an order from your account within 30 minutes of placing it, provided it hasn\'t been packed yet. For modifications, please contact support immediately — once packed, changes aren\'t possible.',
      },
      {
        q: 'Why was my payment deducted but order not confirmed?',
        a: 'This is usually a temporary authorization hold. If the order failed, the amount will be refunded to your original payment method within 5-7 working days. Contact us with the order ID if it takes longer.',
      },
    ],
  },
  {
    title: 'Shipping & Delivery',
    items: [
      {
        q: 'How long does delivery take?',
        a: 'Standard delivery takes 4-6 business days. Express delivery (2-3 days) is available in select metro pincodes. You\'ll see the estimated delivery date at checkout after entering your pincode.',
      },
      {
        q: 'Do you ship internationally?',
        a: 'Currently we only ship within India. International shipping is on our roadmap — sign up for our newsletter to be notified when it launches.',
      },
      {
        q: 'Is shipping free?',
        a: 'Yes, standard shipping is free on orders above ₹2,999. Below that, a flat fee of ₹99 applies. Express delivery carries an additional charge shown at checkout.',
      },
      {
        q: 'Can I change my delivery address after ordering?',
        a: 'Only before the order is packed. Go to your order page and click "Change Address" if available. Once shipped, address changes aren\'t possible — you\'d need to refuse delivery for a return.',
      },
      {
        q: 'What if I\'m not home when the courier arrives?',
        a: 'The courier will attempt delivery twice, usually on consecutive days. If both attempts fail, the package returns to our warehouse and we\'ll contact you to arrange re-delivery or a refund.',
      },
    ],
  },
  {
    title: 'Returns & Exchanges',
    items: [
      {
        q: 'What is your return policy?',
        a: '14 days from delivery. Items must be unworn, unwashed, with all original tags attached and in the original packaging. Underwear, swimwear, and personalized items are non-returnable for hygiene reasons.',
      },
      {
        q: 'How do I start a return or exchange?',
        a: 'Go to your account → Orders → Select the order → Click "Return/Exchange". Choose the items, reason, and preferred resolution (refund or exchange). We\'ll email you a return label and pickup schedule.',
      },
      {
        q: 'Are return pickups free?',
        a: 'Yes, the first return/exchange per order is free. Subsequent returns from the same order may incur a ₹99 pickup fee, which we\'ll deduct from your refund.',
      },
      {
        q: 'How long do refunds take?',
        a: 'Once we receive and inspect the return (usually 2-3 days after pickup), refunds are processed within 24 hours. The time to reflect in your account depends on your bank/payment method: UPI/cards 3-5 days, Net Banking 5-7 days, Wallet instant.',
      },
      {
        q: 'Can I exchange for a different size or colour?',
        a: 'Yes, subject to availability. Select "Exchange" when initiating the return and choose the new variant. If unavailable, we\'ll issue a refund instead.',
      },
    ],
  },
  {
    title: 'Sizing & Fit',
    items: [
      {
        q: 'How do I know my size?',
        a: 'Check the Size Guide on each product page — it shows body measurements for that specific cut. Our general guide is at /size-guide. When between sizes: size up for structured pieces (shirts, jackets, trousers), stay true for knits/jersey.',
      },
      {
        q: 'What if the size doesn\'t fit?',
        a: 'Free exchange within 14 days, subject to stock. Just start an exchange from your order page and select the new size.',
      },
      {
        q: 'Do your clothes run true to size?',
        a: 'Most pieces are true to size. Oversized/relaxed fits are intentionally generous — do not size up on those. Each product page lists the fit type (slim, regular, oversized, relaxed) under Fabric & Care.',
      },
    ],
  },
  {
    title: 'Account & Wallet',
    items: [
      {
        q: 'How do I earn wallet balance?',
        a: 'Wallet credits come from referral commissions (when friends order), cashback on select promotions, and refunds issued to wallet. Balance is visible in Account → Wallet.',
      },
      {
        q: 'Can I withdraw wallet balance to my bank?',
        a: 'Yes, once your wallet balance exceeds ₹500 and is past any referral hold periods. Go to Account → Wallet → Withdraw. Transfers take 1-2 business days via IMPS.',
      },
      {
        q: 'How does the referral program work?',
        a: 'Share your unique code. When a friend signs up and places their first order, you both get rewards — they get a welcome discount, you get commission credited to your wallet after their return window closes.',
      },
    ],
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-4xl">
        <header className="mb-14 max-w-2xl">
          <p className="u-label text-muted-2 mb-3">Support</p>
          <h1 className="u-display text-3xl lg:text-5xl font-light tracking-tight text-ink mb-5">
            Frequently asked questions
          </h1>
          <p className="text-ink-3 text-lg leading-relaxed">
            Quick answers to the things we hear most. Can\'t find what you need?{' '}
            <Link href="/contact" className="text-ink hover:text-accent underline underline-offset-4 u-focus">
              Talk to us
            </Link>
            .
          </p>
        </header>

        <div className="mb-12">
          <label htmlFor="faq-search" className="sr-only">Search FAQs</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" aria-hidden="true" />
            <input
              id="faq-search"
              type="search"
              placeholder="Search questions..."
              className="w-full px-12 py-4 bg-paper border border-line rounded-lg text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="space-y-8">
          {FAQ_CATEGORIES.map((category, catIndex) => (
            <section key={category.title} className="space-y-4">
              <h2 className="u-title text-xl font-semibold text-ink flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-sm font-medium">
                  {catIndex + 1}
                </span>
                {category.title}
              </h2>
              <Accordion type="multiple" className="space-y-3">
                {category.items.map((item, itemIndex) => (
                  <AccordionItem key={itemIndex} value={`${catIndex}-${itemIndex}`}>
                    <AccordionTrigger className="py-4 text-left">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <p className="text-sm text-ink-2 leading-relaxed">{item.a}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>

        <footer className="mt-16 pt-8 border-t border-line text-center">
          <p className="text-ink-2 leading-relaxed mb-4">
            Still have questions? We\'re here to help.
          </p>
          <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus">
            Contact Support
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </footer>
      </div>
    </div>
  );
}