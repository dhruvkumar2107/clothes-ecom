import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactForm } from '@/components/support/ContactForm';
import { Mail, MessageCircle, Clock, Package, RotateCcw, HelpCircle } from 'lucide-react';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Contact Us | LUMEN&CO',
  description:
    'Reach LUMEN&CO about an order, a return, sizing or wholesale. We answer Monday to Saturday, 10:00–19:00 IST.',
  alternates: { canonical: '/contact' },
};

const SUPPORT_EMAIL = 'support@lumen.co';

/** Things people write in about that they can settle faster themselves. */
const SELF_SERVE = [
  {
    icon: Package,
    title: 'Where is my order?',
    body: 'Every courier scan is on the order page in your account, ahead of any email.',
    href: '/account/orders',
    cta: 'Track an order',
  },
  {
    icon: RotateCcw,
    title: 'I want to return something',
    body: '14 days from delivery, unworn and tagged. Start it from the order page.',
    href: '/returns',
    cta: 'Return policy',
  },
  {
    icon: HelpCircle,
    title: 'Sizing, payments, delivery',
    body: 'The questions we get most often, answered in one place.',
    href: '/faq',
    cta: 'Read the FAQs',
  },
];

interface PageProps {
  /** `contact` and `ref` are set by the no-JS form post redirect. */
  searchParams: Promise<{ contact?: string; ref?: string }>;
}

export default async function ContactPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.contact;

  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24">
        <header className="max-w-2xl mb-14">
          <p className="u-label text-muted-2 mb-3">Support</p>
          <h1 className="u-display text-3xl lg:text-5xl font-light tracking-tight text-ink mb-5">
            Talk to us
          </h1>
          <p className="text-ink-3 text-lg leading-relaxed">
            A real person reads every message. Most answers go out the same working day — and if
            something has gone wrong with an order, say so plainly and we will fix it.
          </p>
        </header>

        {/* Answered without us, for the three things people ask most. */}
        <div className="grid sm:grid-cols-3 gap-4 mb-16">
          {SELF_SERVE.map(({ icon: Icon, title, body, href, cta }) => (
            <div
              key={title}
              className="border border-line rounded-lg p-6 bg-paper-2/40 flex flex-col"
            >
              <Icon className="w-5 h-5 text-accent mb-4" aria-hidden="true" />
              <h2 className="u-title text-base font-semibold text-ink mb-2">{title}</h2>
              <p className="text-sm text-ink-3 leading-relaxed flex-1">{body}</p>
              <Link
                href={href}
                className="mt-4 text-sm font-medium text-ink hover:text-accent underline underline-offset-4 u-focus self-start"
              >
                {cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_20rem] gap-12 lg:gap-16 items-start">
          <div>
            <h2 className="u-title text-xl font-semibold text-ink mb-2">Send us a message</h2>
            <p className="text-sm text-ink-3 mb-8">
              You will get a reference number straight away, and an email confirming we have it.
            </p>

            {/* Only shown when JavaScript is off — the form answers inline otherwise. */}
            {status === 'ok' ? (
              <div
                className="mb-8 border border-success/30 bg-success/5 rounded-lg px-4 py-3 text-sm text-ink-2"
                role="status"
              >
                Message received.
                {params.ref ? (
                  <>
                    {' '}
                    Your reference is{' '}
                    <span className="font-mono font-semibold text-ink">{params.ref}</span>.
                  </>
                ) : null}{' '}
                We answer within one working day.
              </div>
            ) : null}
            {status === 'invalid' ? (
              <div
                className="mb-8 border border-danger/30 bg-danger/5 rounded-lg px-4 py-3 text-sm text-danger"
                role="alert"
              >
                Some details were missing or malformed. Please check the form and send it again.
              </div>
            ) : null}
            {status === 'error' ? (
              <div
                className="mb-8 border border-danger/30 bg-danger/5 rounded-lg px-4 py-3 text-sm text-danger"
                role="alert"
              >
                We could not record that just now. Please try again, or email {SUPPORT_EMAIL}.
              </div>
            ) : null}

            <ContactForm />
          </div>

          <aside className="space-y-8 lg:border-l lg:border-line lg:pl-10">
            <div>
              <h2 className="u-label text-ink-3 mb-3">Email</h2>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-start gap-3 text-ink hover:text-accent transition-colors u-focus"
              >
                <Mail className="w-4 h-4 mt-1 shrink-0" aria-hidden="true" />
                <span className="break-all">{SUPPORT_EMAIL}</span>
              </a>
            </div>

            <div>
              <h2 className="u-label text-ink-3 mb-3">WhatsApp</h2>
              <a
                href="https://wa.me/919000000000"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 text-ink hover:text-accent transition-colors u-focus"
              >
                <MessageCircle className="w-4 h-4 mt-1 shrink-0" aria-hidden="true" />
                <span>Message us on WhatsApp</span>
              </a>
              <p className="text-xs text-muted-2 mt-2 leading-relaxed">
                Quickest for a delivery already on its way.
              </p>
            </div>

            <div>
              <h2 className="u-label text-ink-3 mb-3">Hours</h2>
              <p className="flex items-start gap-3 text-ink-2 text-sm leading-relaxed">
                <Clock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  Monday to Saturday
                  <br />
                  10:00 – 19:00 IST
                </span>
              </p>
              <p className="text-xs text-muted-2 mt-2 leading-relaxed">
                Messages sent outside these hours are answered the next working morning.
              </p>
            </div>

            <div className="pt-6 border-t border-line">
              <h2 className="u-label text-ink-3 mb-3">Other enquiries</h2>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="/wholesale"
                    className="text-ink-2 hover:text-ink underline underline-offset-4 u-focus"
                  >
                    Wholesale &amp; stockists
                  </Link>
                </li>
                <li>
                  <Link
                    href="/press"
                    className="text-ink-2 hover:text-ink underline underline-offset-4 u-focus"
                  >
                    Press
                  </Link>
                </li>
                <li>
                  <Link
                    href="/careers"
                    className="text-ink-2 hover:text-ink underline underline-offset-4 u-focus"
                  >
                    Careers
                  </Link>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
