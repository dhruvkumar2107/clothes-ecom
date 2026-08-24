import { db } from './db';
import {
  clampToZero,
  percentOf,
  roundOffDelta,
  sumBy,
  taxFromInclusive,
  type Paise,
} from './money';
import { getSettings } from './settings';
import {
  allocateDiscount,
  computeLineTax,
  summarizeTax,
  taxContext,
  type LineTax,
  type TaxContext,
} from './tax';
import { bestAutoCoupon, validateCoupon, type CouponContext, type CouponResult } from './coupons';
import {
  billableWeight,
  checkServiceability,
  codEligibility,
  quoteShipping,
  type CodEligibility,
} from './shipping';
import { getWallet } from './wallet';
import { sellableOf } from './inventory';

/**
 * The pricing engine.
 *
 * **Every** total the store displays — the cart drawer, the checkout summary, the
 * order record, the invoice — comes from `priceCart`. There is exactly one
 * implementation of "what does this cost", and it runs server-side.
 *
 * That is not architectural purity; it is the only way the numbers agree. The
 * classic failure is a cart page that computes its own subtotal in the browser,
 * a checkout that recomputes it slightly differently, and an order row written
 * from whichever one the client happened to POST. Then a customer is charged
 * ₹4,847 for a cart that said ₹4,850 and nobody can reproduce it.
 *
 * ── Order of operations ────────────────────────────────────────────────────
 *
 * The sequence is fixed and each step depends on the last:
 *
 *   1. Line prices        basePrice + variant priceDelta, snapshotted
 *   2. Subtotal           Σ unitPrice × qty                (pre-discount)
 *   3. Discount           coupon → allocated across lines proportionally
 *   4. Shipping           zone rate, waived above threshold on the *discounted*
 *                         subtotal (a coupon can cost you free shipping — that is
 *                         intentional and matches every major retailer)
 *   5. COD fee            only when COD is both chosen and permitted
 *   6. Tax                per line, on the post-discount value
 *   7. Round-off          to whole rupees, once, at the end
 *   8. Wallet             applied last, against the final total, capped
 *
 * Wallet is deliberately last. It is a payment instrument, not a discount: it
 * must not change the taxable value, because the GST due on a sale doesn't depend
 * on which tender the customer used.
 */

// ── Inputs ──────────────────────────────────────────────────────────────────

export interface PriceCartInput {
  /** Cart to price. Either this or `lines` must be given. */
  cartId?: string;
  /** Pre-resolved lines — used by order re-pricing and admin tools. */
  lines?: readonly PricingLineInput[];
  userId?: string | null;
  /** Destination, for shipping and place-of-supply. */
  address?: {
    pincode?: string | null;
    state?: string | null;
    stateCode?: string | null;
  } | null;
  /** Coupon the customer typed. Null lets auto-apply coupons run. */
  couponCode?: string | null;
  cod?: boolean;
  /** How much wallet balance to spend, in paise. Clamped to what's allowed. */
  walletRequested?: Paise;
  /** Loyalty points to redeem. Clamped to the user's balance. */
  loyaltyPointsRequested?: number;
  /** Skip auto-apply coupon discovery — used when re-pricing an existing order. */
  skipAutoCoupon?: boolean;
}

export interface PricingLineInput {
  key: string;
  variantId: string;
  qty: number;
  /** Explicit price override — an order re-price uses its own snapshot. */
  unitPriceOverride?: Paise;
}

// ── Outputs ─────────────────────────────────────────────────────────────────

export interface PricedLine {
  key: string;
  cartItemId: string | null;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  sku: string;
  size: string;
  color: string;
  imageUrl: string | null;
  hsnCode: string | null;
  categoryId: string;
  collectionIds: string[];

  qty: number;
  /** Price of one unit, tax-inclusive when the store is configured that way. */
  unitPrice: Paise;
  /** MRP for the struck-through display, when higher than unitPrice. */
  compareAtPrice: Paise | null;
  /** unitPrice × qty, before discount. */
  lineSubtotal: Paise;
  /** Share of the cart discount allocated to this line. */
  discount: Paise;
  /** What the customer pays for this line, after discount, including tax. */
  lineTotal: Paise;

  taxRate: number;
  taxAmount: Paise;
  taxableValue: Paise;

  weightGrams: number;
  /** Live sellable count — drives "only 2 left" and blocks checkout. */
  available: number;
  inStock: boolean;
  /** True when qty exceeds what's sellable right now. */
  exceedsStock: boolean;
  /** True when the price changed since the item was added to the cart. */
  priceChanged: boolean;
  priceWas: Paise | null;
}

export interface CartTotals {
  subtotal: Paise;
  discountTotal: Paise;
  couponDiscount: Paise;
  shippingDiscount: Paise;
  loyaltyDiscount: Paise;
  shippingTotal: Paise;
  codFee: Paise;
  taxTotal: Paise;
  /** Signed adjustment to land on whole rupees. */
  roundOff: Paise;
  grandTotal: Paise;
  walletApplied: Paise;
  /** grandTotal − walletApplied. What the gateway (or the courier, for COD) collects. */
  amountDue: Paise;
  /** Σ (compareAtPrice − unitPrice) × qty + discounts + shipping waived. */
  totalSavings: Paise;
  itemCount: number;
  unitCount: number;
}

export interface PricedCart {
  lines: PricedLine[];
  totals: CartTotals;

  coupon: CouponResult | null;
  /** True when the coupon was found by auto-apply rather than typed. */
  couponAutoApplied: boolean;

  tax: {
    context: TaxContext;
    intraState: boolean;
    lines: LineTax[];
    cgst: Paise;
    sgst: Paise;
    igst: Paise;
    byRate: { rate: number; taxableValue: Paise; taxAmount: Paise }[];
  };

  shipping: {
    rate: Paise;
    baseRate: Paise;
    freeShipping: boolean;
    threshold: Paise;
    amountToFreeShipping: Paise;
    zoneName: string | null;
    etaMinDays: number;
    etaMaxDays: number;
    etaLabel: string;
    weightGrams: number;
  };

  cod: CodEligibility & { selected: boolean };

  wallet: {
    balance: Paise;
    /** Most that may be applied to this cart, after the percentage cap. */
    applicable: Paise;
    applied: Paise;
    maxPercent: number;
  };

  loyalty: {
    pointsBalance: number;
    pointsRedeemed: number;
    /** Value of redeemed points, in paise. */
    valueRedeemed: Paise;
    /** Points this order will earn once paid. */
    pointsEarned: number;
  };

  /** Blocking problems — checkout must not proceed while any are present. */
  issues: PricingIssue[];
  /** Non-blocking notices worth showing (price change, low stock). */
  notices: PricingIssue[];
}

export interface PricingIssue {
  code:
    | 'empty_cart'
    | 'out_of_stock'
    | 'insufficient_stock'
    | 'product_unavailable'
    | 'price_changed'
    | 'low_stock'
    | 'not_serviceable'
    | 'cod_unavailable'
    | 'address_required'
    | 'below_minimum';
  message: string;
  lineKey?: string;
  variantId?: string;
}

// ── The engine ──────────────────────────────────────────────────────────────

export async function priceCart(input: PriceCartInput): Promise<PricedCart> {
  const settings = await getSettings([
    'checkout.walletMaxPercent',
    'wallet.enabled',
    'loyalty.enabled',
    'loyalty.pointValue',
    'loyalty.pointsPerHundred',
  ]);

  const issues: PricingIssue[] = [];
  const notices: PricingIssue[] = [];

  // ── 1. Resolve lines ──
  const resolved = input.cartId
    ? await loadCartLines(input.cartId)
    : await loadExplicitLines(input.lines ?? []);

  if (resolved.length === 0) {
    return emptyCart(input, settings['checkout.walletMaxPercent']);
  }

  // `taxRateHint` rides along on the working lines so the tax step can read each
  // product's declared fallback rate; it is stripped from the public shape.
  const lines: (PricedLine & { taxRateHint: number })[] = resolved.map((r) => ({
    ...r,
    discount: 0,
    lineTotal: r.lineSubtotal,
    taxRate: 0,
    taxAmount: 0,
    taxableValue: r.lineSubtotal,
  }));

  for (const line of lines) {
    if (!line.inStock) {
      issues.push({
        code: 'out_of_stock',
        message: `${line.productName} (${line.size}) is out of stock.`,
        lineKey: line.key,
        variantId: line.variantId,
      });
    } else if (line.exceedsStock) {
      issues.push({
        code: 'insufficient_stock',
        message: `Only ${line.available} left of ${line.productName} (${line.size}).`,
        lineKey: line.key,
        variantId: line.variantId,
      });
    } else if (line.available <= 3) {
      notices.push({
        code: 'low_stock',
        message: `Only ${line.available} left — ${line.productName} (${line.size}).`,
        lineKey: line.key,
        variantId: line.variantId,
      });
    }

    if (line.priceChanged) {
      notices.push({
        code: 'price_changed',
        message: `The price of ${line.productName} changed while it was in your bag.`,
        lineKey: line.key,
        variantId: line.variantId,
      });
    }
  }

  // ── 2. Subtotal ──
  const subtotal = sumBy(lines, (l) => l.lineSubtotal);
  const unitCount = lines.reduce((a, l) => a + l.qty, 0);

  // ── 3. Coupon ──
  const isFirstOrder = input.userId ? await isFirstOrderFor(input.userId) : true;

  // Shipping is quoted twice: once provisionally so a free-shipping coupon has a
  // figure to waive, and again after the discount is known so the free-shipping
  // threshold is tested against what the customer actually pays.
  const provisionalShipping = await quoteShipping({
    pincode: input.address?.pincode ?? null,
    state: input.address?.state ?? null,
    subtotal,
    cod: Boolean(input.cod),
  });

  const couponCtx: CouponContext = {
    userId: input.userId ?? null,
    lines: lines.map((l) => ({
      key: l.key,
      productId: l.productId,
      categoryId: l.categoryId,
      collectionIds: l.collectionIds,
      unitPrice: l.unitPrice,
      qty: l.qty,
    })),
    subtotal,
    shippingTotal: provisionalShipping.rate,
    isFirstOrder,
  };

  let coupon: CouponResult | null = null;
  let couponAutoApplied = false;

  if (input.couponCode?.trim()) {
    coupon = await validateCoupon(input.couponCode, couponCtx);
  } else if (!input.skipAutoCoupon) {
    const auto = await bestAutoCoupon(couponCtx);
    if (auto) {
      coupon = auto;
      couponAutoApplied = true;
    }
  }

  const couponDiscount = coupon?.ok ? coupon.discount : 0;
  const couponShippingDiscount = coupon?.ok ? coupon.shippingDiscount : 0;

  // ── 4. Loyalty ──
  const loyaltyState = await resolveLoyalty({
    userId: input.userId ?? null,
    requested: input.loyaltyPointsRequested ?? 0,
    enabled: settings['loyalty.enabled'],
    pointValue: settings['loyalty.pointValue'],
    /** Points may never cover more than the goods themselves. */
    ceiling: clampToZero(subtotal - couponDiscount),
  });

  const discountTotal = couponDiscount + loyaltyState.valueRedeemed;

  // Allocate the whole goods discount across lines so each line's GST is
  // computed on its own true discounted value. `allocateByWeight` guarantees the
  // parts re-sum to the total, so no paisa is created or lost.
  const allocated = allocateDiscount(
    discountTotal,
    lines.map((l) => ({ key: l.key, unitPrice: l.unitPrice, qty: l.qty })),
  );
  for (const line of lines) {
    line.discount = allocated.get(line.key) ?? 0;
  }

  // ── 5. Shipping (final) ──
  const goodsTotal = clampToZero(subtotal - discountTotal);
  const weightGrams = billableWeight(
    lines.map((l) => ({ weightGrams: l.weightGrams, qty: l.qty })),
  );

  const shippingQuote = await quoteShipping({
    pincode: input.address?.pincode ?? null,
    state: input.address?.state ?? null,
    subtotal: goodsTotal,
    cod: Boolean(input.cod),
    weightGrams,
    freeShippingOverride: await tierFreeShipping(input.userId ?? null),
  });

  const shippingBeforeCoupon = shippingQuote.rate;
  const shippingDiscount = Math.min(couponShippingDiscount, shippingBeforeCoupon);
  const shippingTotal = clampToZero(shippingBeforeCoupon - shippingDiscount);

  // ── 6. Tax ──
  const placeOfSupply = input.address?.stateCode ?? '';
  const ctx = await taxContext(placeOfSupply);
  const intraState =
    normalize(ctx.placeOfSupply) === normalize(ctx.sellerStateCode);

  const lineTaxes = await computeLineTax(
    lines.map((l) => ({
      key: l.key,
      unitPrice: l.unitPrice,
      qty: l.qty,
      discount: l.discount,
      hsnCode: l.hsnCode,
      gstRate: l.taxRateHint,
    })),
    ctx,
  );

  const taxByKey = new Map(lineTaxes.map((t) => [t.key, t]));
  for (const line of lines) {
    const tax = taxByKey.get(line.key);
    if (!tax) continue;
    line.taxRate = tax.rate;
    line.taxAmount = tax.taxAmount;
    line.taxableValue = tax.taxableValue;
    line.lineTotal = tax.gross;
  }

  // Shipping is part of a composite supply with the goods, so it carries the
  // dominant goods rate rather than the 18% services rate. Folding it into the
  // tax summary as its own line is what makes the invoice's tax table add up to
  // the invoice's total — an auditor checks exactly that.
  const shippingTaxLine = shippingTaxFor(shippingTotal, lineTaxes, ctx, intraState);
  const allTaxLines = shippingTaxLine ? [...lineTaxes, shippingTaxLine] : [...lineTaxes];
  const summary = summarizeTax(allTaxLines);

  // ── 7. COD & round-off ──
  const preCodTotal = ctx.pricesIncludeTax
    ? goodsTotal + shippingTotal
    : goodsTotal + summary.taxTotal + shippingTotal;

  const codState = await codEligibility({
    pincode: input.address?.pincode ?? null,
    grandTotal: preCodTotal,
  });

  const codSelected = Boolean(input.cod);
  const codFee = codSelected && codState.available ? codState.fee : 0;

  if (codSelected && !codState.available && codState.reason) {
    issues.push({ code: 'cod_unavailable', message: codState.reason });
  }

  const beforeRounding = preCodTotal + codFee;
  const roundOff = roundOffDelta(beforeRounding);
  const grandTotal = clampToZero(beforeRounding + roundOff);

  // ── 8. Wallet ──
  const walletState = await resolveWallet({
    userId: input.userId ?? null,
    requested: input.walletRequested ?? 0,
    enabled: settings['wallet.enabled'],
    maxPercent: settings['checkout.walletMaxPercent'],
    grandTotal,
  });

  const amountDue = clampToZero(grandTotal - walletState.applied);

  // ── Serviceability ──
  if (input.address?.pincode) {
    const service = await checkServiceability(input.address.pincode);
    if (!service.serviceable) {
      issues.push({
        code: 'not_serviceable',
        message: service.reason ?? 'We don’t deliver to this PIN code.',
      });
    }
  }

  const compareSavings = sumBy(lines, (l) =>
    l.compareAtPrice && l.compareAtPrice > l.unitPrice
      ? (l.compareAtPrice - l.unitPrice) * l.qty
      : 0,
  );

  return {
    lines,
    totals: {
      subtotal,
      discountTotal,
      couponDiscount,
      shippingDiscount,
      loyaltyDiscount: loyaltyState.valueRedeemed,
      shippingTotal,
      codFee,
      taxTotal: summary.taxTotal,
      roundOff,
      grandTotal,
      walletApplied: walletState.applied,
      amountDue,
      totalSavings: compareSavings + discountTotal + shippingDiscount,
      itemCount: lines.length,
      unitCount,
    },
    coupon,
    couponAutoApplied,
    tax: {
      context: ctx,
      intraState,
      lines: allTaxLines,
      cgst: summary.cgst,
      sgst: summary.sgst,
      igst: summary.igst,
      byRate: summary.byRate,
    },
    shipping: {
      rate: shippingTotal,
      baseRate: shippingQuote.baseRate,
      freeShipping: shippingQuote.freeShipping || shippingDiscount >= shippingBeforeCoupon,
      threshold: shippingQuote.freeShippingThreshold,
      amountToFreeShipping: shippingQuote.amountToFreeShipping,
      zoneName: shippingQuote.zoneName,
      etaMinDays: shippingQuote.etaMinDays,
      etaMaxDays: shippingQuote.etaMaxDays,
      etaLabel: shippingQuote.etaLabel,
      weightGrams,
    },
    cod: { ...codState, selected: codSelected },
    wallet: walletState,
    loyalty: {
      ...loyaltyState,
      pointsEarned: settings['loyalty.enabled']
        ? Math.floor((goodsTotal / 10_000) * settings['loyalty.pointsPerHundred'])
        : 0,
    },
    issues,
    notices,
  };
}

function normalize(code: string): string {
  const digits = (code ?? '').replace(/\D/g, '');
  return digits ? digits.padStart(2, '0') : '';
}

// ── Line resolution ─────────────────────────────────────────────────────────

type ResolvedLine = Omit<
  PricedLine,
  'discount' | 'lineTotal' | 'taxRate' | 'taxAmount' | 'taxableValue'
> & { taxRateHint: number };

const VARIANT_SELECT = {
  id: true,
  sku: true,
  size: true,
  color: true,
  priceDelta: true,
  stock: true,
  reserved: true,
  weightGrams: true,
  active: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      basePrice: true,
      compareAtPrice: true,
      hsnCode: true,
      gstRate: true,
      status: true,
      categoryId: true,
      // Gallery images carry an optional `colorKey` tying them to a colourway,
      // so a few are fetched and the matching one is picked per line — a cart
      // showing the black shirt's photo for the ivory variant reads as a bug.
      images: {
        where: { kind: 'gallery' },
        orderBy: { sortOrder: 'asc' },
        take: 12,
        select: { url: true, colorKey: true },
      },
      collections: { select: { collectionId: true } },
    },
  },
} as const;

async function loadCartLines(cartId: string): Promise<ResolvedLine[]> {
  const items = await db.cartItem.findMany({
    where: { cartId, savedForLater: false },
    orderBy: { addedAt: 'asc' },
    select: {
      id: true,
      qty: true,
      priceSnapshot: true,
      variantId: true,
      variant: { select: VARIANT_SELECT },
    },
  });

  return items.map((item) =>
    toResolvedLine({
      key: item.id,
      cartItemId: item.id,
      qty: item.qty,
      priceSnapshot: item.priceSnapshot,
      variant: item.variant,
    }),
  );
}

async function loadExplicitLines(
  inputs: readonly PricingLineInput[],
): Promise<ResolvedLine[]> {
  if (inputs.length === 0) return [];

  const variants = await db.productVariant.findMany({
    where: { id: { in: inputs.map((i) => i.variantId) } },
    select: VARIANT_SELECT,
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const out: ResolvedLine[] = [];
  for (const input of inputs) {
    const variant = byId.get(input.variantId);
    if (!variant) continue;
    out.push(
      toResolvedLine({
        key: input.key,
        cartItemId: null,
        qty: input.qty,
        priceSnapshot: input.unitPriceOverride ?? null,
        variant,
        forcePrice: input.unitPriceOverride ?? null,
      }),
    );
  }
  return out;
}

type VariantWithProduct = {
  id: string;
  sku: string;
  size: string;
  color: string;
  priceDelta: number;
  stock: number;
  reserved: number;
  weightGrams: number;
  active: boolean;
  product: {
    id: string;
    name: string;
    slug: string;
    basePrice: number;
    compareAtPrice: number | null;
    hsnCode: string | null;
    gstRate: number;
    status: string;
    categoryId: string;
    images: { url: string; colorKey: string | null }[];
    collections: { collectionId: string }[];
  };
};

/** The gallery image for a specific colourway, falling back to the first. */
function imageForColor(
  images: readonly { url: string; colorKey: string | null }[],
  color: string,
): string | null {
  const key = color.trim().toLowerCase();
  const matched = images.find((i) => i.colorKey?.trim().toLowerCase() === key);
  return matched?.url ?? images[0]?.url ?? null;
}

function toResolvedLine(args: {
  key: string;
  cartItemId: string | null;
  qty: number;
  priceSnapshot: number | null;
  variant: VariantWithProduct;
  forcePrice?: number | null;
}): ResolvedLine {
  const { variant } = args;
  const livePrice = variant.product.basePrice + variant.priceDelta;
  const unitPrice = args.forcePrice ?? livePrice;

  const sellable = sellableOf(variant);
  const purchasable = variant.active && variant.product.status === 'active';

  // A snapshot only counts as "changed" when the live price differs. An absent
  // snapshot (a freshly resolved line) is not a change.
  const priceChanged =
    args.forcePrice === undefined &&
    args.priceSnapshot !== null &&
    args.priceSnapshot !== livePrice;

  return {
    key: args.key,
    cartItemId: args.cartItemId,
    variantId: variant.id,
    productId: variant.product.id,
    productName: variant.product.name,
    productSlug: variant.product.slug,
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    imageUrl: imageForColor(variant.product.images, variant.color),
    hsnCode: variant.product.hsnCode,
    categoryId: variant.product.categoryId,
    collectionIds: variant.product.collections.map((c) => c.collectionId),

    qty: args.qty,
    unitPrice,
    compareAtPrice: variant.product.compareAtPrice,
    lineSubtotal: unitPrice * args.qty,

    weightGrams: variant.weightGrams,
    available: sellable,
    inStock: purchasable && sellable > 0,
    exceedsStock: purchasable && args.qty > sellable,
    priceChanged,
    priceWas: priceChanged ? args.priceSnapshot : null,

    taxRateHint: variant.product.gstRate,
  };
}

// ── Wallet & loyalty resolution ─────────────────────────────────────────────

async function resolveWallet(args: {
  userId: string | null;
  requested: Paise;
  enabled: boolean;
  maxPercent: number;
  grandTotal: Paise;
}): Promise<PricedCart['wallet']> {
  const empty = {
    balance: 0,
    applicable: 0,
    applied: 0,
    maxPercent: args.maxPercent,
  };
  if (!args.userId || !args.enabled) return empty;

  const wallet = await getWallet(args.userId);
  if (!wallet) return empty;

  // `balance` is the cached projection; spendable excludes anything held for a
  // pending withdrawal, which is already committed elsewhere.
  const spendable = clampToZero(wallet.balance - wallet.lockedBalance);
  const percentCap = percentOf(args.grandTotal, Math.min(100, Math.max(0, args.maxPercent)));
  const applicable = Math.min(spendable, percentCap, args.grandTotal);
  const applied = Math.min(clampToZero(args.requested), applicable);

  return { balance: wallet.balance, applicable, applied, maxPercent: args.maxPercent };
}

async function resolveLoyalty(args: {
  userId: string | null;
  requested: number;
  enabled: boolean;
  pointValue: Paise;
  ceiling: Paise;
}): Promise<{ pointsBalance: number; pointsRedeemed: number; valueRedeemed: Paise }> {
  if (!args.userId || !args.enabled || args.requested <= 0) {
    const balance = args.userId && args.enabled ? await loyaltyBalance(args.userId) : 0;
    return { pointsBalance: balance, pointsRedeemed: 0, valueRedeemed: 0 };
  }

  const balance = await loyaltyBalance(args.userId);
  const maxByCeiling =
    args.pointValue > 0 ? Math.floor(args.ceiling / args.pointValue) : 0;
  const pointsRedeemed = Math.max(0, Math.min(args.requested, balance, maxByCeiling));

  return {
    pointsBalance: balance,
    pointsRedeemed,
    valueRedeemed: pointsRedeemed * args.pointValue,
  };
}

async function loyaltyBalance(userId: string): Promise<number> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { loyaltyPoints: true },
  });
  return user?.loyaltyPoints ?? 0;
}

/**
 * Whether the customer's loyalty tier grants free shipping outright.
 *
 * Read from LoyaltyTierDef rather than hard-coded, because the whole point of the
 * tier table is that an operator can add a tier without a deploy.
 */
async function tierFreeShipping(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { loyaltyTier: true },
  });
  if (!user) return false;
  const tier = await db.loyaltyTierDef.findUnique({
    where: { slug: user.loyaltyTier },
    select: { freeShipping: true },
  });
  return tier?.freeShipping ?? false;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * The GST line for shipping.
 *
 * Delivery bundled with goods is a composite supply under s.8(a) of the CGST
 * Act, so it takes the rate of the principal supply. We use the highest goods
 * rate present in the cart, which is the conservative reading — under-collecting
 * on a mixed 5%/12% cart is the error that costs money.
 */
function shippingTaxFor(
  shippingTotal: Paise,
  goodsLines: readonly LineTax[],
  ctx: TaxContext,
  intraState: boolean,
): LineTax | null {
  if (shippingTotal <= 0) return null;

  const rate = goodsLines.reduce((max, l) => Math.max(max, l.rate), 0);
  if (rate <= 0) return null;

  const taxAmount = ctx.pricesIncludeTax
    ? taxFromInclusive(shippingTotal, rate)
    : percentOf(shippingTotal, rate);
  const taxableValue = ctx.pricesIncludeTax ? shippingTotal - taxAmount : shippingTotal;
  const half = Math.floor(taxAmount / 2);

  return {
    key: '__shipping',
    rate,
    taxableValue,
    taxAmount,
    cgst: intraState ? taxAmount - half : 0,
    sgst: intraState ? half : 0,
    igst: intraState ? 0 : taxAmount,
    gross: ctx.pricesIncludeTax ? shippingTotal : shippingTotal + taxAmount,
  };
}

/** Has this user never completed a paid order? Drives first-order-only coupons. */
export async function isFirstOrderFor(userId: string): Promise<boolean> {
  const prior = await db.order.count({
    where: {
      userId,
      paymentStatus: { in: ['paid', 'partially_refunded', 'refunded'] },
    },
  });
  return prior === 0;
}

async function emptyCart(
  input: PriceCartInput,
  maxPercent: number,
): Promise<PricedCart> {
  const ctx = await taxContext(input.address?.stateCode ?? '');
  return {
    lines: [],
    totals: {
      subtotal: 0,
      discountTotal: 0,
      couponDiscount: 0,
      shippingDiscount: 0,
      loyaltyDiscount: 0,
      shippingTotal: 0,
      codFee: 0,
      taxTotal: 0,
      roundOff: 0,
      grandTotal: 0,
      walletApplied: 0,
      amountDue: 0,
      totalSavings: 0,
      itemCount: 0,
      unitCount: 0,
    },
    coupon: null,
    couponAutoApplied: false,
    tax: {
      context: ctx,
      intraState: normalize(ctx.placeOfSupply) === normalize(ctx.sellerStateCode),
      lines: [],
      cgst: 0,
      sgst: 0,
      igst: 0,
      byRate: [],
    },
    shipping: {
      rate: 0,
      baseRate: 0,
      freeShipping: false,
      threshold: 0,
      amountToFreeShipping: 0,
      zoneName: null,
      etaMinDays: 0,
      etaMaxDays: 0,
      etaLabel: '—',
      weightGrams: 0,
    },
    cod: { available: false, fee: 0, reason: null, selected: false },
    wallet: { balance: 0, applicable: 0, applied: 0, maxPercent },
    loyalty: { pointsBalance: 0, pointsRedeemed: 0, valueRedeemed: 0, pointsEarned: 0 },
    issues: [{ code: 'empty_cart', message: 'Your bag is empty.' }],
    notices: [],
  };
}

// ── Display helpers ─────────────────────────────────────────────────────────

/**
 * The summary rows a checkout panel renders, in order, with zero-value rows
 * already dropped. Keeping this here rather than in the component means the cart
 * drawer, the checkout page and the order confirmation can't drift apart.
 */
export function summaryRows(
  totals: CartTotals,
  opts: { intraState: boolean; cgst: Paise; sgst: Paise; igst: Paise } | null = null,
): { label: string; value: Paise; tone?: 'muted' | 'positive' | 'strong' }[] {
  const rows: { label: string; value: Paise; tone?: 'muted' | 'positive' | 'strong' }[] = [
    { label: 'Subtotal', value: totals.subtotal },
  ];

  if (totals.couponDiscount > 0) {
    rows.push({ label: 'Discount', value: -totals.couponDiscount, tone: 'positive' });
  }
  if (totals.loyaltyDiscount > 0) {
    rows.push({ label: 'Points redeemed', value: -totals.loyaltyDiscount, tone: 'positive' });
  }

  rows.push({
    label: totals.shippingTotal === 0 ? 'Shipping (free)' : 'Shipping',
    value: totals.shippingTotal,
    tone: totals.shippingTotal === 0 ? 'positive' : undefined,
  });

  if (totals.codFee > 0) {
    rows.push({ label: 'COD handling', value: totals.codFee });
  }

  // With inclusive pricing the tax is already inside the subtotal, so it is shown
  // as an informational line rather than added — labelling it "(included)" is the
  // difference between a clear invoice and a customer who thinks they were
  // double-charged.
  if (opts && totals.taxTotal > 0) {
    if (opts.intraState) {
      rows.push({ label: 'CGST (included)', value: opts.cgst, tone: 'muted' });
      rows.push({ label: 'SGST (included)', value: opts.sgst, tone: 'muted' });
    } else {
      rows.push({ label: 'IGST (included)', value: opts.igst, tone: 'muted' });
    }
  }

  if (totals.roundOff !== 0) {
    rows.push({ label: 'Round off', value: totals.roundOff, tone: 'muted' });
  }

  rows.push({ label: 'Total', value: totals.grandTotal, tone: 'strong' });

  if (totals.walletApplied > 0) {
    rows.push({ label: 'Wallet applied', value: -totals.walletApplied, tone: 'positive' });
    rows.push({ label: 'To pay', value: totals.amountDue, tone: 'strong' });
  }

  return rows;
}
