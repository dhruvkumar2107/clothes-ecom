/**
 * Built-in content for the standing information and policy pages.
 *
 * These ship with the app so `/shipping`, `/returns` and friends are never a 404
 * on a fresh install. A `Page` row with the same slug overrides the built-in
 * entirely — that is how the admin policy editor works, and why nothing here is
 * ever merged with database content.
 *
 * Sections are structured rather than markdown: no parser to pull in, no HTML to
 * sanitise, and the copy renders in the site's own typography.
 */

export interface ContentSection {
  heading?: string;
  /** Rendered as paragraphs, in order. */
  paragraphs?: string[];
  /** Rendered as a bulleted list after the paragraphs. */
  bullets?: string[];
  /** Rendered as a two-column table; the first row is treated as the header. */
  table?: { columns: string[]; rows: string[][] };
}

export interface StaticPage {
  slug: string;
  title: string;
  /** One line under the title. */
  intro?: string;
  seoDescription: string;
  /** Shown as "Last updated" on policy pages. */
  updated?: string;
  sections: ContentSection[];
}

const SUPPORT_EMAIL = 'support@lumen.co';
const SUPPORT_HOURS = 'Monday to Saturday, 10:00–19:00 IST';
const POLICY_DATE = 'August 24, 2026';

export const STATIC_PAGES: Record<string, StaticPage> = {
  shipping: {
    slug: 'shipping',
    title: 'Shipping Policy',
    intro: 'Where we deliver, what it costs, and how long it takes.',
    seoDescription:
      'LUMEN&CO shipping policy — delivery timelines, charges, serviceable PIN codes and cash-on-delivery rules across India.',
    updated: POLICY_DATE,
    sections: [
      {
        heading: 'Where we deliver',
        paragraphs: [
          'We ship across India to every PIN code our courier partners service. You can check your own PIN code at checkout, on any product page, or while saving an address to your account — the answer includes the delivery window and whether cash on delivery is available there.',
          'A small number of PIN codes are prepaid-only. This is usually a courier restriction rather than a decision of ours, and it can change without notice in either direction.',
        ],
      },
      {
        heading: 'Charges',
        paragraphs: [
          'Shipping is free on orders above ₹2,999. Below that, a flat rate is shown in the order summary before you pay — you will never be charged a delivery fee you have not already seen.',
          'Cash on delivery carries a handling fee, also shown in the summary. Prepaid orders never carry it.',
        ],
      },
      {
        heading: 'Timelines',
        paragraphs: [
          'Orders placed before 14:00 IST on a working day are usually handed to the courier the same day. After that, the next working day.',
        ],
        table: {
          columns: ['Destination', 'Typical delivery'],
          rows: [
            ['Metro cities', '2–4 working days'],
            ['Tier-1 and tier-2 cities', '3–6 working days'],
            ['Remaining serviceable PIN codes', '5–9 working days'],
          ],
        },
      },
      {
        heading: 'Tracking',
        paragraphs: [
          'Every shipment gets a tracking number, emailed to you and shown on the order page under your account. Courier scans can lag reality by a few hours; if tracking has not moved in 48 hours, write to us and we will chase it.',
        ],
      },
      {
        heading: 'Delays outside our control',
        paragraphs: [
          'Weather, strikes, local restrictions and courier network failures do happen. We will keep you informed and, where a shipment is genuinely lost, we will replace or refund it in full.',
        ],
      },
      {
        heading: 'Questions',
        paragraphs: [`Write to ${SUPPORT_EMAIL}. We answer ${SUPPORT_HOURS}.`],
      },
    ],
  },

  returns: {
    slug: 'returns',
    title: 'Returns & Exchanges',
    intro: '14 days to change your mind, in the condition it arrived.',
    seoDescription:
      'How to return or exchange a LUMEN&CO order — eligibility, timelines, pickup, and how refunds are issued.',
    updated: POLICY_DATE,
    sections: [
      {
        heading: 'The window',
        paragraphs: [
          'You have 14 days from delivery to raise a return or exchange. Start it from the order page in your account, or write to us with your order number.',
        ],
      },
      {
        heading: 'What we can accept',
        bullets: [
          'Unworn and unwashed, with all original tags attached',
          'In the original packaging, including any dust bag or box',
          'No alterations, and no perfume, deodorant or makeup marks',
          'Accompanied by the invoice, which is downloadable from your order page',
        ],
      },
      {
        heading: 'What we cannot accept',
        bullets: [
          'Innerwear, swimwear and any item sold as final sale',
          'Items marked non-returnable on the product page at the time of purchase',
          'Items damaged after delivery, or altered by a tailor',
        ],
      },
      {
        heading: 'Exchanges',
        paragraphs: [
          'Size and colour exchanges are free once per order, subject to the replacement being in stock. If it is not, we will refund you instead rather than hold your money against a restock.',
        ],
      },
      {
        heading: 'Pickup',
        paragraphs: [
          'We arrange a reverse pickup wherever the courier supports it — keep the item packed and the invoice with it. Where reverse pickup is unavailable, we will ask you to self-ship and will reimburse a standard courier charge on receipt.',
        ],
      },
      {
        heading: 'Refunds',
        paragraphs: [
          'Once the item reaches our warehouse and passes a quality check, refunds are issued within 5–7 working days. Prepaid orders go back to the original payment method. Cash-on-delivery orders are refunded to your bank account or to your LUMEN&CO wallet, whichever you choose.',
          'Shipping charges already paid are refunded only when the return is our fault — a wrong, damaged or defective item.',
        ],
      },
      {
        heading: 'Something arrived wrong or damaged',
        paragraphs: [
          `Tell us within 48 hours of delivery and send a photograph. We will collect it and send a replacement at our cost, or refund you in full — your choice. Write to ${SUPPORT_EMAIL}.`,
        ],
      },
    ],
  },

  faq: {
    slug: 'faq',
    title: 'Frequently Asked Questions',
    intro: 'The things people ask us most.',
    seoDescription:
      'Answers to common questions about LUMEN&CO orders, sizing, payments, delivery, returns and account management.',
    sections: [
      {
        heading: 'Orders',
        paragraphs: [
          'You can track an order from the Orders page in your account — it shows every courier scan alongside our own status updates. Order changes are possible only while the status is still Pending; once we have packed it, we cannot alter the contents, but you can return it after delivery.',
          'Guest checkout is available. If you later sign up with the same email, past guest orders are attached to the account automatically.',
        ],
      },
      {
        heading: 'Sizing',
        paragraphs: [
          'Every product page carries the size chart for that garment, measured flat in inches and centimetres. Our cuts run true to size unless the page says otherwise — oversized and relaxed fits are labelled as such.',
          'If you are between sizes on a structured piece, size up. On knits and jersey, stay with your usual size.',
        ],
      },
      {
        heading: 'Payments',
        paragraphs: [
          'We accept UPI, credit and debit cards, netbanking, wallets and cash on delivery. Card details are handled entirely by our payment gateway — we never see or store a full card number.',
          'Cash on delivery is available at most PIN codes and up to a value cap shown at checkout. Above that, prepaid only.',
        ],
      },
      {
        heading: 'Delivery',
        paragraphs: [
          'Metro deliveries typically land in 2–4 working days and the rest of the country in 3–9. Check your PIN code at checkout for the exact window before you pay.',
        ],
      },
      {
        heading: 'Returns',
        paragraphs: [
          'Fourteen days from delivery, unworn and tagged. Exchanges are free once per order. The full terms are on the Returns & Exchanges page.',
        ],
      },
      {
        heading: 'Account and privacy',
        paragraphs: [
          'You can sign in with a password or a one-time code sent to your phone or email. You can download or delete your data at any time — ask us and we will action it within 30 days, keeping only what tax law requires us to retain.',
        ],
      },
    ],
  },

  about: {
    slug: 'about',
    title: 'About LUMEN&CO',
    intro: 'Engineered fabrics. Sculptural silhouettes. Made to be worn, not stored.',
    seoDescription:
      'LUMEN&CO makes future-facing luxury clothing in small runs — engineered fabrics, architectural cuts, and honest pricing.',
    sections: [
      {
        heading: 'Why we exist',
        paragraphs: [
          'Most luxury clothing is priced for a story and built for a season. We wanted the opposite: garments engineered for how they behave after fifty wears, sold at a price we can explain line by line.',
          'That means fewer styles, released in small runs, each one revisited until the drape is right rather than until the calendar says ship.',
        ],
      },
      {
        heading: 'How we make things',
        bullets: [
          'Small runs, so a piece can be corrected between drops instead of discounted',
          'Fabrics chosen for weight, recovery and how they age — tested on real wearers, not on a mannequin',
          'Cut and stitched by partner units we visit, in facilities we can name',
          'Priced from cost, not from a target margin backed into a round number',
        ],
      },
      {
        heading: 'What we will not do',
        paragraphs: [
          'We do not run permanent sales, invent original prices to discount from, or manufacture urgency. If a piece is nearly gone we will tell you the number, and if it is not, we will say nothing at all.',
        ],
      },
      {
        heading: 'Where to find us',
        paragraphs: [
          `Online, and on email at ${SUPPORT_EMAIL}. There is no store yet; when there is, you will hear it from us first.`,
        ],
      },
    ],
  },

  sustainability: {
    slug: 'sustainability',
    title: 'Sustainability',
    intro: 'What we actually do, and what we have not solved yet.',
    seoDescription:
      'LUMEN&CO on materials, production waste, packaging and the parts of our supply chain we are still working on.',
    sections: [
      {
        heading: 'Our position',
        paragraphs: [
          'Clothing manufacture has a real footprint and no amount of copywriting removes it. What follows is what we do, stated plainly, and what we have not fixed.',
        ],
      },
      {
        heading: 'Materials',
        bullets: [
          'Natural and cellulosic fibres wherever the garment allows it',
          'Recycled synthetics where performance genuinely requires a synthetic',
          'No virgin fur, no exotic skins, no angora',
        ],
      },
      {
        heading: 'Production',
        paragraphs: [
          'Small runs mean less deadstock, which is the single largest waste stream in fashion. Cutting waste is collected and returned to the mill where a recycler accepts it.',
        ],
      },
      {
        heading: 'Packaging',
        bullets: [
          'Recycled kraft mailers and paper tape — no plastic mailers',
          'No tissue, no printed inserts, no card you throw away on opening',
          'Return labels are digital; nothing extra ships out in case you send it back',
        ],
      },
      {
        heading: 'Not solved yet',
        paragraphs: [
          'Our last-mile delivery is not carbon neutral, and we are not going to buy offsets to claim that it is. Dye-house water treatment is verified at one of our two mills, not both. We will update this page as that changes, including if it changes for the worse.',
        ],
      },
    ],
  },

  careers: {
    slug: 'careers',
    title: 'Careers',
    intro: 'A small team, hiring rarely and carefully.',
    seoDescription: 'Open roles and how hiring works at LUMEN&CO.',
    sections: [
      {
        heading: 'How we hire',
        paragraphs: [
          'We hire slowly. Every role gets a written brief before it is posted, a paid exercise instead of a whiteboard, and a decision within two weeks of your last conversation. If we say no, we will tell you why.',
        ],
      },
      {
        heading: 'Open roles',
        paragraphs: [
          'Nothing is open right now. We keep applications on file for six months and read every one.',
        ],
      },
      {
        heading: 'Writing to us anyway',
        paragraphs: [
          `Send what you have made to ${SUPPORT_EMAIL} with "Careers" in the subject. A portfolio, a repository or a paragraph about a problem you solved is worth more to us than a formatted CV.`,
        ],
      },
    ],
  },

  press: {
    slug: 'press',
    title: 'Press',
    intro: 'Assets, facts and who to ask.',
    seoDescription: 'LUMEN&CO press contact, company facts and brand asset requests.',
    sections: [
      {
        heading: 'Contact',
        paragraphs: [
          `For interviews, samples and comment, write to ${SUPPORT_EMAIL} with "Press" in the subject. We answer ${SUPPORT_HOURS}.`,
        ],
      },
      {
        heading: 'The facts',
        bullets: [
          'LUMEN&CO is an Indian direct-to-consumer clothing label',
          'We sell online only, shipping across India',
          'Collections are released as small numbered drops rather than seasons',
        ],
      },
      {
        heading: 'Brand assets',
        paragraphs: [
          'Logos, lookbook imagery and product shots are available on request. Please do not recolour the wordmark, set it in another typeface, or crop it into a lockup with another brand.',
        ],
      },
    ],
  },

  wholesale: {
    slug: 'wholesale',
    title: 'Wholesale & Stockists',
    intro: 'For multi-brand retailers and concept stores.',
    seoDescription: 'Wholesale terms and how to apply to stock LUMEN&CO.',
    sections: [
      {
        heading: 'Who we work with',
        paragraphs: [
          'We stock a small number of multi-brand retailers whose buy reflects the way the collection is designed — full looks rather than a scatter of bestsellers.',
        ],
      },
      {
        heading: 'Terms',
        bullets: [
          'Minimum first order of ₹1,50,000 at wholesale',
          'Two drops a year, with a four-week window to confirm each buy',
          'Freight at cost; returns on faulty stock only',
          'GST registration and a trade reference required',
        ],
      },
      {
        heading: 'Applying',
        paragraphs: [
          `Write to ${SUPPORT_EMAIL} with "Wholesale" in the subject. Include your store, its location, the brands you carry and your GSTIN. We answer every application, including the ones we decline.`,
        ],
      },
    ],
  },

  cookies: {
    slug: 'cookies',
    title: 'Cookie Policy',
    intro: 'What we store in your browser, and why.',
    seoDescription:
      'The cookies and local storage LUMEN&CO uses, what each one does, and how to control them.',
    updated: POLICY_DATE,
    sections: [
      {
        heading: 'Strictly necessary',
        paragraphs: [
          'These make the site work at all and cannot be switched off from within the site. Blocking them in your browser will break sign-in and checkout.',
        ],
        table: {
          columns: ['Purpose', 'Lifetime'],
          rows: [
            ['Session cookie — keeps you signed in', 'Up to 30 days'],
            ['Cart identifier — remembers an anonymous cart', 'Up to 30 days'],
            ['Security token — blocks cross-site request forgery', 'Session'],
            ['Theme and currency preference', '1 year'],
          ],
        },
      },
      {
        heading: 'Analytics',
        paragraphs: [
          'We record page and product views to understand what people look at. These are stored against a rotating identifier, not against your name, and are aggregated before anyone reads them.',
        ],
      },
      {
        heading: 'Local storage',
        paragraphs: [
          'Recently viewed products, your open cart drawer state and unsent form drafts are kept in your browser and never sent to us. Clearing site data removes them.',
        ],
      },
      {
        heading: 'What we do not do',
        paragraphs: [
          'We do not sell cookie data, do not run third-party advertising pixels on this site, and do not fingerprint your device.',
        ],
      },
      {
        heading: 'Your controls',
        paragraphs: [
          'Every browser can block or clear cookies per site, usually under Privacy or Site Settings. Signing out clears your session cookie immediately.',
        ],
      },
    ],
  },

  accessibility: {
    slug: 'accessibility',
    title: 'Accessibility',
    intro: 'What we have built for, and how to tell us where it fails.',
    seoDescription:
      'LUMEN&CO accessibility commitments, known gaps, and how to report a barrier.',
    updated: POLICY_DATE,
    sections: [
      {
        heading: 'Our target',
        paragraphs: [
          'We build against WCAG 2.1 Level AA. That is a target we work towards continuously rather than a certificate we hold.',
        ],
      },
      {
        heading: 'What is in place',
        bullets: [
          'Every interactive element is reachable and operable by keyboard, with a visible focus ring',
          'Semantic landmarks and headings, so screen readers can skim the page structure',
          'Text contrast checked against AA on both the light and dark palettes',
          'Alternative text on product and editorial imagery; decorative images are hidden from assistive technology',
          'Form fields have real labels, and errors are announced rather than only coloured',
          'Motion is reduced automatically when your system asks for it',
        ],
      },
      {
        heading: 'Known gaps',
        bullets: [
          'The 360° product viewer has no keyboard equivalent yet — the still gallery carries the same imagery',
          'A few admin-only screens are not yet audited; they are not customer-facing',
        ],
      },
      {
        heading: 'Reporting a barrier',
        paragraphs: [
          `If something here blocked you, write to ${SUPPORT_EMAIL} with the page and what happened. We treat access bugs as functional bugs, not as feature requests, and we will tell you what we did about it.`,
        ],
      },
    ],
  },
};

/** Slugs the CMS route will serve without a database row. */
export const STATIC_PAGE_SLUGS = Object.keys(STATIC_PAGES);

export function getStaticPage(slug: string): StaticPage | null {
  return STATIC_PAGES[slug] ?? null;
}
