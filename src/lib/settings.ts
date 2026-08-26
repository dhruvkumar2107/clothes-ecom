import { db } from './db';
import { readJson } from './json';

/**
 * Runtime configuration.
 *
 * Business rules that an operator should be able to change without a deploy —
 * COD limits, withdrawal thresholds, commission hold windows, shipping rates —
 * live in the `Setting` table and are edited at /admin/settings.
 *
 * Every key must be declared in SETTING_DEFS below. That gives us three things
 * a bare KV store wouldn't: a typed `getSetting` (the return type follows the
 * declared `type`), a default that applies before the table is ever seeded, and
 * an auto-generated admin UI with real labels and help text instead of raw keys.
 *
 * Secrets (gateway keys) are the exception: they stay in environment variables,
 * never the database. A few are *mirrored* here as write-only fields so an
 * operator can paste keys in the admin — see `isSecret`, which masks them on
 * read and blocks them from ever reaching a client component.
 */

type SettingType = 'string' | 'number' | 'boolean' | 'json';

interface SettingDef {
  type: SettingType;
  default: string;
  group:
    | 'general'
    | 'payments'
    | 'payouts'
    | 'shipping'
    | 'tax'
    | 'seo'
    | 'theme'
    | 'referral'
    | 'marketing'
    | 'loyalty';
  label: string
  description?: string;
  isSecret?: boolean;
  /** Rendered as a money input (value is paise). */
  money?: boolean;
}

export const SETTING_DEFS = {
  // ── General ───────────────────────────────────────────────────────────────
  'store.name': {
    type: 'string',
    default: 'LUMEN&CO',
    group: 'general',
    label: 'Store name',
  },
  'store.tagline': {
    type: 'string',
    default: 'Light as couture',
    group: 'general',
    label: 'Tagline',
  },
  'store.supportEmail': {
    type: 'string',
    default: 'concierge@lumenandco.example',
    group: 'general',
    label: 'Support email',
  },
  'store.supportPhone': {
    type: 'string',
    default: '+91 22 4000 1234',
    group: 'general',
    label: 'Support phone',
  },
  'store.defaultCurrency': {
    type: 'string',
    default: 'INR',
    group: 'general',
    label: 'Default currency',
  },
  'store.defaultLocale': {
    type: 'string',
    default: 'en',
    group: 'general',
    label: 'Default language',
  },

  // ── Checkout & COD ────────────────────────────────────────────────────────
  'cod.enabled': {
    type: 'boolean',
    default: 'true',
    group: 'payments',
    label: 'Enable Cash on Delivery',
    description: 'Global kill-switch. Per-pincode availability is managed separately.',
  },
  'cod.fee': {
    type: 'number',
    default: '4900',
    group: 'payments',
    label: 'COD handling fee',
    description: 'Added to the order total when COD is chosen.',
    money: true,
  },
  'cod.maxOrderValue': {
    type: 'number',
    default: '2500000',
    group: 'payments',
    label: 'COD order ceiling',
    description: 'Orders above this must be prepaid. ₹25,000 default.',
    money: true,
  },
  'cod.minOrderValue': {
    type: 'number',
    default: '0',
    group: 'payments',
    label: 'COD order floor',
    money: true,
  },
  'checkout.freeShippingAbove': {
    type: 'number',
    default: '299900',
    group: 'shipping',
    label: 'Free shipping above',
    description: 'Cart subtotal at which shipping is waived. ₹2,999 default.',
    money: true,
  },
  'checkout.defaultShippingRate': {
    type: 'number',
    default: '9900',
    group: 'shipping',
    label: 'Default shipping rate',
    description: 'Fallback when no shipping zone matches the address.',
    money: true,
  },
  'checkout.returnWindowDays': {
    type: 'number',
    default: '14',
    group: 'shipping',
    label: 'Return window (days)',
    description: 'Also gates when referral commission unlocks.',
  },
  'checkout.walletMaxPercent': {
    type: 'number',
    default: '100',
    group: 'payments',
    label: 'Max wallet share of an order (%)',
    description: 'Set below 100 to force a minimum gateway payment on every order.',
  },
  'payments.allowRetry': {
    type: 'boolean',
    default: 'true',
    group: 'payments',
    label: 'Allow payment retry',
    description: 'Lets a customer re-attempt payment on a failed order instead of re-ordering.',
  },
  'payments.emiMinAmount': {
    type: 'number',
    default: '300000',
    group: 'payments',
    label: 'Minimum order for EMI',
    money: true,
  },

  // ── Referral engine ───────────────────────────────────────────────────────
  'referral.enabled': {
    type: 'boolean',
    default: 'true',
    group: 'referral',
    label: 'Enable referral programme',
  },
  'referral.holdDays': {
    type: 'number',
    default: '14',
    group: 'referral',
    label: 'Commission hold (days)',
    description:
      'Commission stays locked this long after delivery so a return can reverse it before it becomes withdrawable.',
  },
  'referral.minOrderValue': {
    type: 'number',
    default: '100000',
    group: 'referral',
    label: 'Minimum order value to earn',
    description: 'Referred order must exceed this before any commission accrues. ₹1,000 default.',
    money: true,
  },
  'referral.welcomeCouponCode': {
    type: 'string',
    default: 'WELCOME10',
    group: 'referral',
    label: 'Welcome coupon for invitees',
    description: 'Auto-applied to a referred user’s first order.',
  },
  'referral.blockSameDevice': {
    type: 'boolean',
    default: 'true',
    group: 'referral',
    label: 'Block same-device referrals',
    description: 'Hard-blocks commission when referrer and referee share a device fingerprint.',
  },
  'referral.flagSameIp': {
    type: 'boolean',
    default: 'true',
    group: 'referral',
    label: 'Flag same-IP referrals',
    description: 'Flags for review rather than blocking — shared NAT is common and legitimate.',
  },
  'referral.velocityThreshold': {
    type: 'number',
    default: '5',
    group: 'referral',
    label: 'Signup velocity threshold',
    description: 'Referrals accepted within 24h before the chain is flagged for review.',
  },

  // ── Wallet & payouts ──────────────────────────────────────────────────────
  'wallet.enabled': {
    type: 'boolean',
    default: 'true',
    group: 'payouts',
    label: 'Enable wallet',
  },
  'wallet.withdrawalEnabled': {
    type: 'boolean',
    default: 'true',
    group: 'payouts',
    label: 'Enable bank withdrawals',
  },
  'wallet.minWithdrawal': {
    type: 'number',
    default: '50000',
    group: 'payouts',
    label: 'Minimum withdrawal',
    description: '₹500 default. Below this, payout fees make transfers uneconomical.',
    money: true,
  },
  'wallet.maxWithdrawalPerDay': {
    type: 'number',
    default: '5000000',
    group: 'payouts',
    label: 'Daily withdrawal cap per user',
    money: true,
  },
  'wallet.autoApproveBelow': {
    type: 'number',
    default: '200000',
    group: 'payouts',
    label: 'Auto-approve withdrawals below',
    description:
      'Requests under this go straight to the payout gateway. Above it, they queue for staff approval. Set to 0 to review everything.',
    money: true,
  },
  'wallet.withdrawalFee': {
    type: 'number',
    default: '0',
    group: 'payouts',
    label: 'Withdrawal fee (flat)',
    money: true,
  },
  'wallet.requireVerifiedBank': {
    type: 'boolean',
    default: 'true',
    group: 'payouts',
    label: 'Require verified bank account',
    description:
      'Blocks payouts to destinations that have not passed penny-drop verification. Turning this off is strongly discouraged.',
  },
  'wallet.nameMatchThreshold': {
    type: 'number',
    default: '80',
    group: 'payouts',
    label: 'Name-match threshold (%)',
    description:
      'Minimum similarity between the account holder name and the name the bank returns before verification passes.',
  },

  // ── Tax & invoicing ───────────────────────────────────────────────────────
  'tax.gstin': {
    type: 'string',
    default: '27AABCL1234M1ZQ',
    group: 'tax',
    label: 'Seller GSTIN',
  },
  'tax.legalName': {
    type: 'string',
    default: 'LUMEN AND CO PVT LTD',
    group: 'tax',
    label: 'Registered legal name',
  },
  'tax.address': {
    type: 'string',
    default: 'Unit 14, Kamala Mills, Lower Parel, Mumbai 400013, Maharashtra',
    group: 'tax',
    label: 'Registered address',
  },
  'tax.stateCode': {
    type: 'string',
    default: '27',
    group: 'tax',
    label: 'Seller state code',
    description: 'Decides CGST+SGST (intra-state) vs IGST (inter-state) on every invoice.',
  },
  'tax.pricesIncludeTax': {
    type: 'boolean',
    default: 'true',
    group: 'tax',
    label: 'Prices include GST',
    description: 'Indian apparel MRP is tax-inclusive. Turning this off changes every total.',
  },
  'tax.invoicePrefix': {
    type: 'string',
    default: 'LMN',
    group: 'tax',
    label: 'Invoice number prefix',
  },

  // ── Loyalty ───────────────────────────────────────────────────────────────
  'loyalty.enabled': {
    type: 'boolean',
    default: 'true',
    group: 'loyalty',
    label: 'Enable loyalty points',
  },
  'loyalty.pointsPerHundred': {
    type: 'number',
    default: '5',
    group: 'loyalty',
    label: 'Points per ₹100 spent',
  },
  'loyalty.pointValue': {
    type: 'number',
    default: '100',
    group: 'loyalty',
    label: 'Value of 1 point',
    description: 'In paise. 100 = ₹1 per point.',
    money: true,
  },
  'loyalty.pointsExpiryDays': {
    type: 'number',
    default: '365',
    group: 'loyalty',
    label: 'Points expiry (days)',
  },

  // ── Marketing ─────────────────────────────────────────────────────────────
  'marketing.abandonedCartEnabled': {
    type: 'boolean',
    default: 'true',
    group: 'marketing',
    label: 'Abandoned cart recovery',
  },
  'marketing.abandonedCartDelayMinutes': {
    type: 'json',
    default: '[60, 1440, 4320]',
    group: 'marketing',
    label: 'Recovery nudge schedule (minutes)',
    description: 'Minutes after abandonment for nudge 1, 2, 3. Default: 1h, 24h, 72h.',
  },
  'marketing.exitIntentEnabled': {
    type: 'boolean',
    default: 'true',
    group: 'marketing',
    label: 'Exit-intent popup',
  },
  'marketing.newsletterCoupon': {
    type: 'string',
    default: 'FIRSTLIGHT',
    group: 'marketing',
    label: 'Newsletter signup coupon',
  },

  // ── Theme ─────────────────────────────────────────────────────────────────
  'theme.accentPrimary': {
    type: 'string',
    default: '#8B5CF6',
    group: 'theme',
    label: 'Primary accent (electric violet)',
  },
  'theme.accentSecondary': {
    type: 'string',
    default: '#2DD4BF',
    group: 'theme',
    label: 'Secondary accent (holographic teal)',
  },
  'theme.accentTertiary': {
    type: 'string',
    default: '#C0C4CC',
    group: 'theme',
    label: 'Tertiary accent (chrome silver)',
  },
  'theme.enableCursorGlow': {
    type: 'boolean',
    default: 'true',
    group: 'theme',
    label: 'Cursor-follow glow (desktop)',
  },
  'theme.enableGrain': {
    type: 'boolean',
    default: 'true',
    group: 'theme',
    label: 'Film-grain overlay',
  },

  // ── SEO ───────────────────────────────────────────────────────────────────
  'seo.defaultTitle': {
    type: 'string',
    default: 'LUMEN&CO — Light as couture',
    group: 'seo',
    label: 'Default page title',
  },
  'seo.defaultDescription': {
    type: 'string',
    default:
      'Future-facing luxury fashion. Engineered fabrics, sculptural silhouettes, and limited drops — shipped across India.',
    group: 'seo',
    label: 'Default meta description',
  },
  'seo.ogImage': {
    type: 'string',
    default: '/api/img/og?title=LUMEN%26CO',
    group: 'seo',
    label: 'Default OG image',
  },
} as const satisfies Record<string, SettingDef>;

export type SettingKey = keyof typeof SETTING_DEFS;

/** Maps a declared setting type to the TS type `getSetting` returns. */
type ValueOf<K extends SettingKey> = (typeof SETTING_DEFS)[K]['type'] extends 'number'
  ? number
  : (typeof SETTING_DEFS)[K]['type'] extends 'boolean'
    ? boolean
    : (typeof SETTING_DEFS)[K]['type'] extends 'json'
      ? unknown
      : string;

// ── Cache ───────────────────────────────────────────────────────────────────
//
// Settings are read on nearly every request (checkout reads a dozen) but change
// rarely. A short-lived process-local cache keeps that off the database without
// making an admin edit feel stale — writes invalidate immediately, and the TTL
// only matters for multi-instance deployments.

const CACHE_TTL_MS = 30_000;
/** Retry window after a failed read — short, so the app recovers as soon as the DB does. */
const CACHE_ERROR_TTL_MS = 5_000;
let cache: Map<string, string> | null = null;
let cacheExpiresAt = 0;

/**
 * Load the Setting table into the process cache.
 *
 * Fails soft. An unreachable database or a missing `Setting` table yields an
 * empty map, so every reader falls back to its declared `default`. This matters
 * because the root layout awaits settings on every request: letting the error
 * propagate turns one DB fault into a 500 on *every* route, including the 404
 * page — which is why a missing /favicon.ico returned 500 instead of 404.
 * Serving default theme colours is strictly better than serving nothing.
 *
 * Writes (`setSetting`, `seedSettings`) deliberately still throw: an admin save
 * that silently did nothing would be worse than an error.
 */
async function loadCache(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cache && now < cacheExpiresAt) return cache;

  try {
    const rows = await db.setting.findMany({ select: { key: true, value: true } });
    cache = new Map(rows.map((r) => [r.key, r.value]));
    cacheExpiresAt = now + CACHE_TTL_MS;
  } catch (err) {
    console.error('[settings] read failed — falling back to declared defaults:', err);
    cache = new Map();
    cacheExpiresAt = now + CACHE_ERROR_TTL_MS;
  }
  return cache;
}

export function invalidateSettingsCache(): void {
  cache = null;
  cacheExpiresAt = 0;
}

function coerce(raw: string, type: SettingType): unknown {
  switch (type) {
    case 'number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }
    case 'boolean':
      return raw === 'true' || raw === '1';
    case 'json':
      return readJson<unknown>(raw, null);
    default:
      return raw;
  }
}

/**
 * Read one setting, typed by its declaration. Falls back to the declared
 * default when the row is missing, so the app works against an unseeded DB.
 */
export async function getSetting<K extends SettingKey>(key: K): Promise<ValueOf<K>> {
  const def = SETTING_DEFS[key] as SettingDef;
  const store = await loadCache();
  const raw = store.get(key) ?? def.default;
  return coerce(raw, def.type) as ValueOf<K>;
}

/** Read several settings in one pass — one cache hit rather than N. */
export async function getSettings<K extends SettingKey>(
  keys: readonly K[],
): Promise<{ [P in K]: ValueOf<P> }> {
  const store = await loadCache();
  const out = {} as { [P in K]: ValueOf<P> };
  for (const key of keys) {
    const def = SETTING_DEFS[key] as SettingDef;
    const raw = store.get(key) ?? def.default;
    out[key] = coerce(raw, def.type) as ValueOf<typeof key>;
  }
  return out;
}

/** Write a setting. Coerces to the declared type and invalidates the cache. */
export async function setSetting<K extends SettingKey>(
  key: K,
  value: ValueOf<K> | string,
): Promise<void> {
  const def = SETTING_DEFS[key] as SettingDef;
  const serialized =
    def.type === 'json'
      ? typeof value === 'string'
        ? value
        : JSON.stringify(value)
      : String(value);

  await db.setting.upsert({
    where: { key },
    update: { value: serialized },
    create: {
      key,
      value: serialized,
      valueType: def.type,
      group: def.group,
      label: def.label,
      description: def.description ?? null,
      isSecret: def.isSecret ?? false,
    },
  });

  invalidateSettingsCache();
}

/** All settings in a group, with metadata — powers the admin settings forms. */
export async function getSettingGroup(group: SettingDef['group']) {
  const store = await loadCache();
  return (Object.entries(SETTING_DEFS) as [SettingKey, SettingDef][])
    .filter(([, def]) => def.group === group)
    .map(([key, def]) => ({
      key,
      label: def.label,
      description: def.description ?? null,
      type: def.type,
      money: def.money ?? false,
      isSecret: def.isSecret ?? false,
      value: def.isSecret ? '' : (store.get(key) ?? def.default),
      isDefault: !store.has(key),
    }));
}

/** Seed every declared setting at its default. Idempotent. */
export async function seedSettings(): Promise<number> {
  const entries = Object.entries(SETTING_DEFS) as [SettingKey, SettingDef][];
  let created = 0;

  for (const [key, def] of entries) {
    const existing = await db.setting.findUnique({ where: { key }, select: { id: true } });
    if (existing) continue;
    await db.setting.create({
      data: {
        key,
        value: def.default,
        valueType: def.type,
        group: def.group,
        label: def.label,
        description: def.description ?? null,
        isSecret: def.isSecret ?? false,
      },
    });
    created++;
  }

  invalidateSettingsCache();
  return created;
}
