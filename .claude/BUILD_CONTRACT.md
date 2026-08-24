# LUMEN&CO — BUILD CONTRACT (single source of truth for all build agents)

The domain layer (`src/lib/**`, 59 files) and `prisma/schema.prisma` (76 models)
are COMPLETE and typecheck clean. We are building the **application layer**:
`src/app/**`, `src/components/**`, `prisma/seed.ts`, `middleware.ts`.

Because many agents build in parallel, this file is the interface all of them
code against. If a component/helper listed here is not yet on disk, ASSUME IT
EXISTS and import it — another agent is writing it right now. Do not create your
own copy, do not inline a substitute.

---

## 0. HARD RULES

1. **NEVER modify** `src/lib/**` (except the one file your prompt explicitly
   assigns you), `prisma/schema.prisma`, `package.json`, `next.config.ts`,
   `tsconfig.json`, `.env`, `.env.example`, or this file.
2. **Only create/edit the files your prompt assigns you.** Another agent owns
   everything else. Overwriting their work destroys it.
3. **No new dependencies.** Available: next 15, react 19, tailwindcss v4,
   @prisma/client, zod 3, zustand 5, framer-motion 11, lucide-react, recharts 2,
   clsx, tailwind-merge, bcryptjs, jose, nodemailer, papaparse, pdf-lib.
4. **No test framework exists.** Do not write tests.
5. Read the parts of `prisma/schema.prisma` and `src/lib/**` you actually need.
   The lib layer is well commented — the comments tell you *why*, trust them.
   Never guess a function signature: open the file and read it.
6. Match the existing code style: 2-space indent, single quotes, semicolons,
   named exports, `// ── Section ──` banner comments, and comments that explain
   *why* a decision was made rather than restating the code.
7. TypeScript `strict` is on. No `any` unless genuinely unavoidable; no
   `@ts-ignore`. `npx tsc --noEmit` must stay clean.
8. Windows dev box. Use POSIX-style import paths; never hardcode separators.

---

## 1. FRAMEWORK CONVENTIONS

- Next.js 15 **App Router**, React 19, under `src/app/**`.
- **Server Components by default.** A page that reads data imports the relevant
  `src/lib` function and calls it directly — it does NOT fetch its own API.
- `'use client'` only for interactivity (forms, drawers, tabs, charts, anything
  using `useState`/`onClick`).
- **Next 15 async APIs** — `params`/`searchParams` are Promises:
  ```ts
  export default async function Page({ params, searchParams }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }) {
    const { slug } = await params;
    const sp = await searchParams;
  ```
  `cookies()` and `headers()` are async too — `await cookies()`.
- Route handler with a dynamic segment:
  ```ts
  export const GET = handler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
    const { id } = await params;
  ```
- **No Server Actions.** Client mutations POST to `/api/**` via `fetch`.
- Pages reading cookies or live DB state: `export const dynamic = 'force-dynamic';`
- Metadata via `export const metadata: Metadata` or `generateMetadata()` on
  public pages.

### Client fetch helper — `src/components/lib/fetcher.ts` (owned by F1)
```ts
export class ApiClientError extends Error {
  code: string; field?: string; status: number; details?: unknown;
}
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T>;
// POSTs JSON when `init.body` is a plain object; unwraps { ok:true, data } and
// throws ApiClientError on { ok:false }.
```
Every client form uses `apiFetch` so server error copy surfaces verbatim — the
lib layer writes customer-safe messages on purpose (see `fail()` in `src/lib/api.ts`).

---

## 2. DESIGN LANGUAGE

**LUMEN&CO — ultra-premium fashion.** Editorial, quiet, generous whitespace,
gallery-like. Sharp corners (radius 2–4px; never pill except chips), hairline
rules, uppercase micro-labels with wide tracking, large serif display type
against a small grotesque body. Motion slow and restrained (400–700ms, custom
ease). Warm paper, near-black ink, muted gold. **Never** neon gradients,
shadows on everything, or bouncy animation.

### Fonts — CSS stacks only. DO NOT use `next/font`.
A webfont fetch would make the build depend on network access.
```
--font-display: 'Didot', 'Bodoni MT', 'Playfair Display', 'Times New Roman', Georgia, serif;
--font-sans: ui-sans-serif, system-ui, 'Segoe UI', Inter, Helvetica, Arial, sans-serif;
```

### Tokens — `src/app/globals.css`, Tailwind v4 `@theme` (owned by F1)
Tailwind v4 has **no `tailwind.config.js`** — tokens are declared in CSS:
```css
@import 'tailwindcss';

@theme {
  --color-ink: #0b0b0c;        /* primary text, dark surfaces */
  --color-ink-2: #1a1b1e;
  --color-ink-3: #2e3034;
  --color-paper: #fbfaf7;      /* page background (warm off-white) */
  --color-paper-2: #f4f2ec;    /* raised / alternate surface */
  --color-paper-3: #ebe8e0;
  --color-line: #e0dcd2;       /* hairline rules */
  --color-line-2: #cfc9bc;
  --color-muted: #6f6a61;      /* secondary text */
  --color-muted-2: #938d82;
  --color-accent: #b08d57;     /* muted gold — runtime-overridable */
  --color-accent-2: #7c8b7a;   /* sage */
  --color-accent-3: #8c5f56;   /* clay */
  --color-success: #3f6b4f;
  --color-warning: #9a6f22;
  --color-danger: #8f2f2a;
  --color-info: #3c5a78;

  --font-display: 'Didot', 'Bodoni MT', 'Playfair Display', 'Times New Roman', Georgia, serif;
  --font-sans: ui-sans-serif, system-ui, 'Segoe UI', Inter, Helvetica, Arial, sans-serif;

  --radius-xs: 2px;
  --radius-sm: 3px;
  --radius-md: 4px;

  --ease-lux: cubic-bezier(0.16, 1, 0.3, 1);
}
```
`theme.accentPrimary|accentSecondary|accentTertiary` are **Settings** values.
The root layout reads them and sets `--color-accent`, `--color-accent-2`,
`--color-accent-3` inline on `<html>` so an admin can rebrand without a deploy.
The values above are the static fallback.

Utility classes F1 also defines in `globals.css` (use these everywhere):
- `.u-label` — uppercase 11px, `letter-spacing: 0.18em`, muted
- `.u-display` — display font, tight leading, slight negative tracking
- `.u-rule` — 1px hairline in `--color-line`
- `.u-container` — `mx-auto w-full max-w-[1440px] px-5 md:px-8 lg:px-12`
- `.u-narrow` — `mx-auto w-full max-w-[720px] px-5`
- `.u-focus` — shared `:focus-visible` ring (accent, 2px offset)
- `.u-grain` — subtle inline-SVG noise overlay, gated on `theme.enableGrain`
- `.u-reveal` — scroll-in opacity/translate (CSS only)

**Dark mode is out of scope** — storefront and admin are both light/paper. Do
not add `prefers-color-scheme` blocks.

### Accessibility (non-negotiable)
Semantic landmarks; every input has a `<label>`; visible focus via `.u-focus`;
icon-only buttons carry `aria-label`; modals/drawers trap focus, close on
Escape, restore focus on close; `aria-live="polite"` on toasts and cart/qty
updates; real `alt` text; body contrast ≥ 4.5:1; `prefers-reduced-motion`
respected.

---

## 3. UI PRIMITIVES — `src/components/ui/` (owned by F1)

Barrel `src/components/ui/index.ts` re-exports everything:
`import { Button, Input } from '@/components/ui';`

Every primitive takes `className?` merged via `cn()` from `@/lib/utils`,
forwards remaining native props, and forwards refs where a ref makes sense.

```ts
// Button.tsx (client)
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;       // Spinner + disabled + aria-busy
  fullWidth?: boolean;
  href?: string;           // renders next/link instead of <button>
  icon?: React.ReactNode;      // leading
  iconRight?: React.ReactNode;
};

// Field.tsx — label/hint/error shell used by every input
type FieldProps = { label?: string; hint?: string; error?: string;
  required?: boolean; htmlFor?: string; children: React.ReactNode; className?: string };

// Input.tsx / Textarea.tsx — native props + { label?, hint?, error?, icon?, suffix? }
// Select.tsx    — native props + { label?, hint?, error?, options?: {value,label}[] }
//                 (children <option> also allowed)
// Checkbox.tsx / Switch.tsx — { label?, hint?, error? } + native props
// RadioGroup.tsx — { name, value, onChange, options: {value,label,hint?}[], label? }
// MoneyInput.tsx — value/onChange in PAISE (number), displays rupees
//                  { label?, hint?, error?, value: number, onChange: (paise: number) => void }
// QtyStepper.tsx — { value, onChange, min?, max?, disabled?, size? }

// Badge.tsx       { tone?: Tone; size?: 'sm'|'md'; children }   Tone from '@/lib/enums'
// StatusChip.tsx  { status: string | null | undefined; label? }
//                  uses toneFor() + humanize() from '@/lib/enums'
// Card.tsx        exports Card, CardHeader, CardBody, CardFooter
// Alert.tsx       { tone?: Tone; title?: string; children; onDismiss? }
// EmptyState.tsx  { icon?: React.ReactNode; title: string; description?: string; action? }
// Spinner.tsx     { size?: 'sm'|'md'|'lg' }
// Skeleton.tsx    { className?; lines?: number }  — also exports SkeletonCard
// Avatar.tsx      { name?: string | null; src?: string | null; size?: 'sm'|'md'|'lg' }
// Rating.tsx      { value: number; count?: number; size?: 'sm'|'md'; showCount?: boolean }
// Progress.tsx    { value: number; max?: number; tone?: Tone; label? }
// Price.tsx       { amount: number /* paise */; compareAt?: number | null;
//                   size?: 'sm'|'md'|'lg'|'xl'; showSavings?: boolean }
// Breadcrumbs.tsx { items: { label: string; href?: string }[] }
// Pagination.tsx  { page: number; perPage: number; total: number; baseHref: string }
//                  link-based (server-render friendly), preserves other query params
// Table.tsx       exports Table, THead, TBody, TR, TH, TD, TableWrap
//                  TableWrap adds horizontal overflow scroll — REQUIRED around every
//                  admin table so the page body never scrolls sideways
// Tabs.tsx        (client) { tabs: {id,label,count?}[]; value; onChange }
//                  + TabLinks for URL-driven tabs { tabs: {id,label,href,count?}[]; active }
// Accordion.tsx   (client) { items: {id,title,content}[]; defaultOpen?: string[] }
// Modal.tsx       (client) { open, onClose, title?, size?: 'sm'|'md'|'lg', children, footer? }
//                  focus trap, Escape, scroll lock, portal
// Drawer.tsx      (client) same + { side?: 'right'|'left'|'bottom' }
// Dropdown.tsx    (client) { trigger: React.ReactNode; items: DropdownItem[]; align? }
//                  DropdownItem = { label, href?, onClick?, icon?, danger?, separator? }
// Tooltip.tsx     (client) { content: string; children; side? }
// Toast.tsx       (client) exports ToastProvider (mounted once in providers.tsx) and
//                  useToast(): { toast(t: { message: string; title?: string;
//                    tone?: Tone; duration?: number }): void }
//                  backed by a zustand store in the same file
// ConfirmDialog.tsx (client) { open, onClose, onConfirm, title, message,
//                    confirmLabel?, danger?, loading? }
// FileDrop.tsx    (client) { onFile: (file: File) => void; accept?: string; label? }
// CopyButton.tsx  (client) { value: string; label? } — clipboard + toast
// Sparkline.tsx   { data: number[]; tone?: Tone; height? } — inline SVG, no recharts
```

**Recharts** charts live in `src/components/admin/charts/` and are owned by the
reports agent, not F1.

---

## 4. GENERATED IMAGERY — zero external assets

`src/lib/img.ts` **ALREADY EXISTS on disk** (written by the lead — read it, do
not modify it). `src/app/api/img/[...spec]/route.ts` is owned by F2.

URL shape (path-based, so the immutable cache header `next.config.ts` sets for
`/api/img/(.*)` applies):
```
/api/img/{kind}/{seed}/{w}x{h}.svg[?label=...&tone=...]
kind: product | flat | hero | lookbook | banner | avatar | og
```
The route returns a deterministic SVG derived from `seed` (hash → palette,
composition, drape/weave geometry). Same seed ⇒ byte-identical output.
`Content-Type: image/svg+xml; charset=utf-8`.

`src/lib/img.ts` exports (read the file for full signatures — it also exports
`hashSeed`, `seedFloat`, `seedInt`, `seedPick`, `paletteFor`, `shiftHex`,
`parseImgPath`, `CLOTH_COLOR_NAMES`, `MAX_IMG_DIMENSION`, and the `ImgPalette`
type, which the route and the seed script both build on):
```ts
export type ImgKind = 'product' | 'flat' | 'hero' | 'lookbook' | 'banner' | 'avatar' | 'og';
export function img(kind: ImgKind, seed: string, w: number, h: number,
                    opts?: { label?: string; tone?: string }): string;
export function productImg(seed: string, index?: number): string;  // 1200x1600
export function flatImg(seed: string): string;                     // 1200x1600
export function heroImg(seed: string): string;                     // 2400x1350
export function lookbookImg(seed: string): string;                 // 1600x2000
export function bannerImg(seed: string): string;                   // 2400x800
export function avatarImg(seed: string): string;                   // 256x256
export function ogImg(seed: string, label?: string): string;       // 1200x630
export function swatchHex(color: string): string; // colour name -> hex
```
`prisma/seed.ts` stores these URL strings in `ProductImage.url`,
`Banner.imageUrl`, etc. Render with a plain `<img>` (they are SVG; `next/image`
optimisation adds nothing) — always with `alt`, `loading="lazy"` below the fold,
and an explicit `width`/`height` or aspect-ratio box to prevent layout shift.

---

## 5. API LAYER

Every handler wraps in `handler()` from `@/lib/api` and uses its helpers:
`ok`, `created`, `noContent`, `parse`, `parseForm`, `parseQuery`, `q`,
`pageParams`, `paginated`, `csvResponse`, `fileResponse`, plus the throwers
`badRequest`, `notFound`, `conflict`, `unauthorized`, `forbidden`.
Never write your own try/catch — `fail()` already maps every domain error class
to the right status and a customer-safe message.

Envelope (already implemented): `{ ok: true, data }` /
`{ ok: false, error: { code, message, field?, details? } }`.

**Auth**
- Customer routes: `const session = await requireCustomer();` from `@/lib/auth`
  (throws `AuthRequiredError` → 401 automatically).
- Admin routes: `const staff = await requirePermission('orders.write');` from
  `@/lib/auth/guard`. Money-moving or destructive admin actions also `audit({...})`
  (or use `requirePermissionAndAudit`).
- Sensitive routes rate-limit with `enforce('<policy>', identity)` from
  `@/lib/rate-limit`. The policy keys are exactly: `auth.login`, `auth.register`,
  `auth.password-reset`, `otp.send`, `otp.verify`, `coupon.validate`,
  `checkout.create`, `payment.intent`, `withdrawal.create`, `bank.verify`,
  `review.create`, `newsletter.subscribe`, `contact.submit`,
  `serviceability.check`, `search.query`, `analytics.track`.

**Validation** — zod v3 schemas inline in the route file, or in
`src/app/api/<area>/_schemas.ts` when shared by sibling routes. Use `zEnum()`
from `@/lib/enums` for enum fields so API and DB agree.

**Webhooks** (`/api/webhooks/*`) read the raw body for signature verification,
are idempotent via the `WebhookEvent` table, and return 200 once recorded so the
vendor stops retrying.

---

## 6. ROUTE MAP

### Storefront (public)
```
/                        home — editorial hero, collections, featured, new in, referral strip
/shop                    all products (filter + sort + pagination)
/shop/[category]         category PLP
/collections             collection index
/collections/[slug]      collection PLP (lookbook header)
/product/[slug]          PDP — gallery, variants, size guide, reviews, Q&A, related
/search                  search results
/cart                    cart page
/checkout                address → shipping → payment (single stepped page)
/checkout/success/[orderNumber]   thank-you + referral share
/track                   guest order tracking (order number + phone/email)
/track/[orderNumber]     tracking detail
/wishlist                wishlist
/journal                 blog index
/journal/[slug]          blog post
/lookbook                editorial lookbook
/size-guide              size guide
/refer                   referral programme landing (public explainer)
/pages/[slug]            CMS pages (about, contact, faq, shipping, returns, privacy, terms)
/login /signup /forgot-password /reset-password /verify   auth screens
```

### Account (customer, auth required — own layout with sidebar)
```
/account                        overview
/account/orders                 order history
/account/orders/[id]            order detail (invoice, timeline, return CTA)
/account/orders/[id]/return     start return / exchange
/account/returns                returns list
/account/addresses              address book
/account/wallet                 balance + statement
/account/wallet/withdraw        withdrawal request flow
/account/bank                   bank accounts + verification
/account/referrals              referral dashboard (link, earnings, referred people, tiers)
/account/loyalty                points + tier
/account/reviews                my reviews
/account/profile                name/email/phone/password/security
/account/sessions               active sessions
```

### Admin (staff, permission-gated — own layout with sidebar + topbar)
```
/admin/login
/admin                          dashboard (KPIs, charts, alerts)
/admin/orders  /admin/orders/[id]
/admin/returns /admin/returns/[id]
/admin/shipments
/admin/products /admin/products/new /admin/products/[id]
/admin/inventory                stock table, low-stock, CSV import, ledger
/admin/categories /admin/collections
/admin/reviews /admin/questions
/admin/customers /admin/customers/[id]
/admin/discounts /admin/discounts/new /admin/discounts/[id]
/admin/referrals /admin/referrals/rules /admin/referrals/flags /admin/referrals/[id]
/admin/wallet /admin/wallet/[userId]
/admin/payouts /admin/payouts/[id]      withdrawal queue: approve / reject / retry
/admin/bank-verifications
/admin/payments /admin/payments/webhooks
/admin/cms/banners /admin/cms/sections /admin/cms/pages /admin/cms/blog /admin/cms/seo
/admin/marketing/campaigns /admin/marketing/outbox /admin/marketing/newsletter
      /admin/marketing/abandoned-carts
/admin/reports                  sales, products, referrals, tax, exports
/admin/settings/[group]         general|payments|payouts|shipping|tax|seo|theme|referral|marketing|loyalty
/admin/staff /admin/staff/roles
/admin/audit-log
/admin/system                   adapter status (mock vs live) detail
```

### API
```
/api/auth/{signup,login,logout,session,otp/start,otp/verify,social/[provider],
           social/[provider]/callback,forgot-password,reset-password,change-password}
/api/products /api/products/[slug] /api/products/[slug]/reviews /api/products/[slug]/questions
/api/search /api/categories /api/collections
/api/cart /api/cart/items /api/cart/items/[id] /api/cart/coupon /api/cart/note
/api/wishlist /api/wishlist/[variantId]
/api/checkout/quote /api/checkout/place /api/checkout/pay /api/checkout/verify
/api/orders /api/orders/[id] /api/orders/[id]/cancel /api/orders/[id]/invoice
/api/orders/[id]/returns /api/track
/api/addresses /api/addresses/[id]
/api/account/profile /api/account/password /api/account/sessions /api/account/identifier
/api/wallet /api/wallet/statement /api/wallet/withdraw /api/wallet/withdraw/[id]/cancel
/api/bank /api/bank/[id] /api/bank/[id]/verify /api/bank/[id]/default /api/bank/ifsc/[ifsc]
/api/referral /api/referral/link /api/referral/validate/[code]
/api/loyalty
/api/shipping/serviceability /api/shipping/quote
/api/newsletter /api/contact /api/analytics/event
/api/img/[...spec]
/api/webhooks/{razorpay,stripe,shiprocket,delhivery,payouts,verification}
/api/cron/{abandoned-carts,release-commissions,release-holds,expire-orders,prune}
/api/admin/**                   mirrors the admin screens
/sitemap.xml /robots.txt        as app/sitemap.ts and app/robots.ts
```

---

## 7. SHARED APP CHROME (owned by F4 — assume it exists)

```
src/app/layout.tsx            root: html/body, tokens from Settings, Providers, SkipLink
src/app/providers.tsx         'use client' — ToastProvider + client context
src/app/(store)/layout.tsx    storefront shell: AnnouncementBar + Header + Footer
src/app/not-found.tsx  src/app/error.tsx  src/app/loading.tsx
src/components/store/Header.tsx         sticky, mega-menu, search, cart count, account
src/components/store/Footer.tsx
src/components/store/AnnouncementBar.tsx
src/components/store/MobileNav.tsx      (client) drawer nav
src/components/store/CartDrawer.tsx     (client) mini-cart
src/components/store/SearchOverlay.tsx  (client) command-palette style search
src/components/store/cart-store.ts      zustand: count, drawer open state, refresh()
src/app/account/layout.tsx    AccountSidebar shell (requireCustomer)
src/app/admin/layout.tsx      AdminShell (requireStaff) — sidebar, topbar, mock-driver banner
src/components/admin/AdminSidebar.tsx   permission-filtered nav
src/components/admin/PageHeader.tsx     { title, description?, actions?, breadcrumbs? }
src/components/admin/Filters.tsx        (client) URL-query filter bar
src/components/admin/DataTable.tsx      server-rendered table + Pagination + empty state
middleware.ts                 cookie-presence redirect guard for /account and /admin
```

`middleware.ts` must NOT import from `src/lib` (Prisma is not edge-safe). It
checks only cookie presence. The literal cookie names are `lmn_session`
(customer) and `lmn_staff` (staff) — confirmed against `COOKIE_NAMES` in
`src/lib/auth/session.ts`.

The product card is shared, owned by the PLP agent:
`src/components/store/ProductCard.tsx` — `{ product: ProductCardData }`, with
`ProductCardData` exported from `src/components/store/product-card-types.ts`:
```ts
export interface ProductCardData {
  id: string; slug: string; name: string; subtitle: string | null;
  price: number; compareAtPrice: number | null;
  imageUrl: string; hoverImageUrl: string | null;
  ratingAvg: number; ratingCount: number; badge: string | null;
  colors: { color: string; colorHex: string }[]; sizes: string[]; inStock: boolean;
}
```

---

## 8. SEED DATA SHAPE (owned by F3 — `prisma/seed.ts`)

Idempotent (`upsert` by natural key), re-runnable, ~15–25s. It must produce a
store that looks like a real business on day 400:

- **Settings** — `seedSettings()` from `@/lib/settings`, then override from env.
- **Staff** — `SYSTEM_ROLES` from `@/lib/auth/permissions` → `StaffRole`; users
  `owner@lumenandco.example` / `manager@…` / `support@…`, password `Lumen@2026`
  (hash via `hashPassword`).
- **Customers** — ~40 users, password `Passw0rd!`, realistic Indian names and
  phones, a real 2-level referral tree, wallets with history, 6 with bank
  accounts spread across verification states.
- **Catalogue** — 8 categories, 6 collections, **~70 products**, each with 3–6
  variants across `SIZES` and 2–3 colours, 3–5 `ProductImage` rows from
  `src/lib/img.ts`, tags, size guides, opening `InventoryLedger` rows.
  Deliberately include 2 out-of-stock, 4 low-stock, 3 draft, 2 archived.
- **Pincodes** — ~120 rows across metros and tier-2; some non-serviceable, some
  COD-disabled.
- **Orders** — ~180 spread over the last 14 months, weighted recent, covering
  every `ORDER_STATUS`/`PAYMENT_STATUS` combination the state machine allows,
  with `OrderEvent` timelines, `Invoice`s, `Shipment`s + events,
  `PaymentIntent`/`PaymentAttempt`, 12 returns across `RETURN_STATUS`, 8 refunds.
  Write via `db` directly (NOT `createOrder`) so history can be backdated — but
  keep every derived total consistent with `src/lib/pricing.ts` semantics
  (paise, tax-inclusive, `roundOff`).
- **Referral** — `ReferralRule` (one active, one expired), `ReferralTier`s,
  `Referral` rows, `ReferralCommission` at every `COMMISSION_STATUS`, 3
  `ReferralFraudFlag`s.
- **Wallet** — transactions of every `WALLET_TXN_TYPE`; 5 `WithdrawalRequest`s
  across statuses with `PayoutAttempt`s. Balances MUST reconcile:
  `verifyIntegrity()` from `@/lib/wallet` has to pass for every user.
- **Coupons** — 8 (percent, flat, free-ship, first-order, and the referral
  welcome code from `referral.welcomeCouponCode`), with redemptions.
- Loyalty tiers + transactions. Tax rules. Shipping zones. Currency (INR).
- **Reviews** (~200, some with media, a few unapproved) and Questions/Answers.
- **CMS** — 6 banners, homepage sections, 8 blog posts, the CMS `Page`s in the
  route map, `SeoMeta`.
- **Marketing** — campaigns, newsletter subscribers, abandoned carts, Outbox rows.
- **Analytics** — `AnalyticsEvent` + `DailyMetric` for the last 120 days so the
  admin dashboard charts have real curves.
- Finish by printing a summary table and the login credentials.

**Determinism** — seed a small PRNG (mulberry32) with a fixed constant; never
`Math.random()`. Derive all dates from a fixed `NOW` constant so the data set is
reproducible.

---

## 9. QUALITY BAR

This is a portfolio-grade flagship build, not a scaffold.

- No `TODO`, no placeholder copy, no lorem ipsum, no dead links, no stray
  `console.log`. Every page is finished and populated.
- Copy reads like a real luxury brand — specific and confident, never
  "Welcome to our store!". Editorial and product copy is concrete.
- Every list view has a loading skeleton, an empty state, an error state, and
  works at seeded data volume.
- Every form: labels, inline validation, disabled + spinner while submitting,
  server error surfaced through `apiFetch`, success toast or redirect.
- Money is ALWAYS paise in code, formatted through `Price` / the `money` lib.
  Never do float arithmetic on money in a component.
- Mobile-first; verify mentally at 375px, 768px, 1280px, 1600px.
- Prefer CSS for simple motion; reserve `framer-motion` for genuinely
  orchestrated sequences (hero, PDP gallery, drawer). Respect
  `prefers-reduced-motion`.
