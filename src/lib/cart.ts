import { cookies } from 'next/headers';
import { db, tx } from './db';
import { generateSessionKey } from './ids';
import { ApiFailure } from './api';
import { sellableOf } from './inventory';
import { priceCart, type PricedCart } from './pricing';
import { addMinutes } from './utils';

/**
 * The cart.
 *
 * A cart exists before a customer does. Guests get one keyed by an httpOnly
 * cookie; signing in merges it into the user's cart rather than discarding it,
 * because a customer who browses, adds three things, then logs in to check out
 * and finds an empty bag does not come back.
 *
 * `priceSnapshot` on each item records the price at add-to-cart time. It is never
 * used to charge — `priceCart` always re-derives from the live product — but it
 * lets the cart say "this went up while it was in your bag", which is the honest
 * alternative to silently changing the number.
 */

const CART_COOKIE = 'lc_cart';
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export interface CartRef {
  id: string;
  userId: string | null;
  sessionKey: string | null;
  couponCode: string | null;
}

// ── Resolution ──────────────────────────────────────────────────────────────

/**
 * Get the active cart for this request, creating one if needed.
 *
 * When a userId is given, the user's cart wins and any guest cart on the cookie
 * is merged in. This is called on every cart mutation, so the merge happens on
 * the first authenticated action rather than needing an explicit login hook.
 */
export async function resolveCart(userId: string | null): Promise<CartRef> {
  const jar = await cookies();
  const cookieKey = jar.get(CART_COOKIE)?.value ?? null;

  if (userId) {
    const userCart = await db.cart.findFirst({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, userId: true, sessionKey: true, couponCode: true },
    });

    const guestCart = cookieKey
      ? await db.cart.findUnique({
          where: { sessionKey: cookieKey },
          select: { id: true, userId: true, status: true },
        })
      : null;

    // A guest cart with no owner belongs to whoever just signed in.
    if (guestCart && !guestCart.userId && guestCart.status === 'active') {
      if (userCart) {
        await mergeCarts(guestCart.id, userCart.id);
        return userCart;
      }
      const claimed = await db.cart.update({
        where: { id: guestCart.id },
        data: { userId, sessionKey: null, lastActivityAt: new Date() },
        select: { id: true, userId: true, sessionKey: true, couponCode: true },
      });
      return claimed;
    }

    if (userCart) return userCart;

    const fresh = await db.cart.create({
      data: { userId, status: 'active' },
      select: { id: true, userId: true, sessionKey: true, couponCode: true },
    });
    return fresh;
  }

  // ── Guest ──
  if (cookieKey) {
    const existing = await db.cart.findUnique({
      where: { sessionKey: cookieKey },
      select: { id: true, userId: true, sessionKey: true, couponCode: true, status: true },
    });
    if (existing && existing.status === 'active') return existing;
  }

  const sessionKey = generateSessionKey();
  const created = await db.cart.create({
    data: { sessionKey, status: 'active' },
    select: { id: true, userId: true, sessionKey: true, couponCode: true },
  });

  jar.set(CART_COOKIE, sessionKey, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: CART_COOKIE_MAX_AGE,
  });

  return created;
}

/** Read-only lookup — never creates a cart. Used by GET handlers. */
export async function findCart(userId: string | null): Promise<CartRef | null> {
  if (userId) {
    return db.cart.findFirst({
      where: { userId, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, userId: true, sessionKey: true, couponCode: true },
    });
  }

  const jar = await cookies();
  const key = jar.get(CART_COOKIE)?.value;
  if (!key) return null;

  const cart = await db.cart.findUnique({
    where: { sessionKey: key },
    select: { id: true, userId: true, sessionKey: true, couponCode: true, status: true },
  });
  return cart && cart.status === 'active' ? cart : null;
}

/**
 * Fold a guest cart into a user cart.
 *
 * Quantities **add** rather than overwrite, and are capped at what's sellable —
 * a customer who added 2 on their phone and 1 on the laptop meant 3, but only if
 * 3 exist. The guest cart is deleted, not kept, so a stale cookie can't
 * resurrect it later.
 */
export async function mergeCarts(fromCartId: string, intoCartId: string): Promise<void> {
  if (fromCartId === intoCartId) return;

  await tx(async (client) => {
    const [source, target] = await Promise.all([
      client.cartItem.findMany({
        where: { cartId: fromCartId },
        select: { variantId: true, qty: true, priceSnapshot: true, savedForLater: true },
      }),
      client.cartItem.findMany({
        where: { cartId: intoCartId },
        select: { id: true, variantId: true, qty: true },
      }),
    ]);

    if (source.length === 0) {
      await client.cart.delete({ where: { id: fromCartId } });
      return;
    }

    const variants = await client.productVariant.findMany({
      where: { id: { in: source.map((s) => s.variantId) } },
      select: { id: true, stock: true, reserved: true },
    });
    const stockById = new Map(variants.map((v) => [v.id, sellableOf(v)]));
    const targetByVariant = new Map(target.map((t) => [t.variantId, t]));

    for (const item of source) {
      const existing = targetByVariant.get(item.variantId);
      const sellable = stockById.get(item.variantId) ?? 0;
      if (sellable <= 0) continue;

      if (existing) {
        await client.cartItem.update({
          where: { id: existing.id },
          data: { qty: Math.min(existing.qty + item.qty, sellable, MAX_QTY_PER_LINE) },
        });
      } else {
        await client.cartItem.create({
          data: {
            cartId: intoCartId,
            variantId: item.variantId,
            qty: Math.min(item.qty, sellable, MAX_QTY_PER_LINE),
            priceSnapshot: item.priceSnapshot,
            savedForLater: item.savedForLater,
          },
        });
      }
    }

    // Carry over a coupon the guest had applied, unless the user already has one.
    const [fromCart, intoCart] = await Promise.all([
      client.cart.findUnique({ where: { id: fromCartId }, select: { couponCode: true } }),
      client.cart.findUnique({ where: { id: intoCartId }, select: { couponCode: true } }),
    ]);
    if (fromCart?.couponCode && !intoCart?.couponCode) {
      await client.cart.update({
        where: { id: intoCartId },
        data: { couponCode: fromCart.couponCode },
      });
    }

    await client.cart.delete({ where: { id: fromCartId } });
    await client.cart.update({
      where: { id: intoCartId },
      data: { lastActivityAt: new Date() },
    });
  });
}

// ── Mutations ───────────────────────────────────────────────────────────────

/**
 * Cap per line. Not a stock limit — a guard against a fat-fingered quantity
 * field turning into a ₹4 lakh order that has to be manually cancelled.
 */
export const MAX_QTY_PER_LINE = 10;

export async function addToCart(input: {
  cartId: string;
  variantId: string;
  qty?: number;
}): Promise<void> {
  const qty = Math.max(1, Math.min(input.qty ?? 1, MAX_QTY_PER_LINE));

  const variant = await db.productVariant.findUnique({
    where: { id: input.variantId },
    select: {
      id: true,
      stock: true,
      reserved: true,
      active: true,
      priceDelta: true,
      product: { select: { basePrice: true, status: true, name: true } },
    },
  });

  if (!variant || !variant.active || variant.product.status !== 'active') {
    throw new ApiFailure('unavailable', 'That item is no longer available.', 409);
  }

  const sellable = sellableOf(variant);
  if (sellable <= 0) {
    throw new ApiFailure('out_of_stock', `${variant.product.name} is out of stock.`, 409);
  }

  const existing = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId: input.cartId, variantId: input.variantId } },
    select: { id: true, qty: true, savedForLater: true },
  });

  const desired = (existing && !existing.savedForLater ? existing.qty : 0) + qty;
  const finalQty = Math.min(desired, sellable, MAX_QTY_PER_LINE);

  if (existing && desired > sellable) {
    throw new ApiFailure(
      'insufficient_stock',
      `Only ${sellable} available. Your bag already has ${existing.qty}.`,
      409,
    );
  }

  const priceSnapshot = variant.product.basePrice + variant.priceDelta;

  if (existing) {
    await db.cartItem.update({
      where: { id: existing.id },
      // Adding an item that was saved for later moves it back into the bag —
      // that is what the customer just asked for.
      data: { qty: finalQty, savedForLater: false, priceSnapshot },
    });
  } else {
    await db.cartItem.create({
      data: {
        cartId: input.cartId,
        variantId: input.variantId,
        qty: finalQty,
        priceSnapshot,
      },
    });
  }

  await touchCart(input.cartId);
}

export async function updateQty(input: {
  cartId: string;
  itemId: string;
  qty: number;
}): Promise<void> {
  if (input.qty <= 0) {
    return removeFromCart({ cartId: input.cartId, itemId: input.itemId });
  }

  const item = await db.cartItem.findFirst({
    where: { id: input.itemId, cartId: input.cartId },
    select: {
      id: true,
      variant: {
        select: { stock: true, reserved: true, product: { select: { name: true } } },
      },
    },
  });
  if (!item) throw new ApiFailure('not_found', 'That item is not in your bag.', 404);

  const sellable = sellableOf(item.variant);
  const qty = Math.min(input.qty, MAX_QTY_PER_LINE);

  if (qty > sellable) {
    throw new ApiFailure(
      'insufficient_stock',
      sellable === 0
        ? `${item.variant.product.name} just sold out.`
        : `Only ${sellable} of ${item.variant.product.name} left.`,
      409,
    );
  }

  await db.cartItem.update({ where: { id: item.id }, data: { qty } });
  await touchCart(input.cartId);
}

export async function removeFromCart(input: {
  cartId: string;
  itemId: string;
}): Promise<void> {
  await db.cartItem.deleteMany({ where: { id: input.itemId, cartId: input.cartId } });
  await touchCart(input.cartId);
}

/** Move an item to (or back from) "saved for later". */
export async function setSavedForLater(input: {
  cartId: string;
  itemId: string;
  saved: boolean;
}): Promise<void> {
  await db.cartItem.updateMany({
    where: { id: input.itemId, cartId: input.cartId },
    data: { savedForLater: input.saved },
  });
  await touchCart(input.cartId);
}

export async function clearCart(cartId: string): Promise<void> {
  await db.cartItem.deleteMany({ where: { cartId, savedForLater: false } });
  await db.cart.update({
    where: { id: cartId },
    data: { couponCode: null, lastActivityAt: new Date() },
  });
}

export async function applyCouponToCart(cartId: string, code: string | null): Promise<void> {
  await db.cart.update({
    where: { id: cartId },
    data: {
      couponCode: code?.trim().toUpperCase() || null,
      lastActivityAt: new Date(),
    },
  });
}

export async function setCartNote(cartId: string, note: string | null): Promise<void> {
  await db.cart.update({
    where: { id: cartId },
    data: { note: note?.trim().slice(0, 500) || null },
  });
}

async function touchCart(cartId: string): Promise<void> {
  await db.cart.update({
    where: { id: cartId },
    data: { lastActivityAt: new Date() },
  });
  // Activity cancels an abandonment record — the customer came back on their own,
  // so the recovery emails must stop.
  await db.abandonedCart.updateMany({
    where: { cartId, recoveredAt: null },
    data: { recoveredAt: new Date() },
  });
}

// ── Reading ─────────────────────────────────────────────────────────────────

export interface CartView extends PricedCart {
  cartId: string | null;
  savedForLater: SavedLine[];
  note: string | null;
}

export interface SavedLine {
  itemId: string;
  variantId: string;
  productName: string;
  productSlug: string;
  size: string;
  color: string;
  imageUrl: string | null;
  unitPrice: number;
  inStock: boolean;
}

/**
 * The full cart view: priced lines, totals, and the saved-for-later shelf.
 *
 * This is what every cart surface renders from — the drawer, the cart page, and
 * the checkout summary. One function, one set of numbers.
 */
export async function getCartView(input: {
  userId: string | null;
  address?: {
    pincode?: string | null;
    state?: string | null;
    stateCode?: string | null;
  } | null;
  cod?: boolean;
  walletRequested?: number;
  loyaltyPointsRequested?: number;
}): Promise<CartView> {
  const cart = await findCart(input.userId);

  if (!cart) {
    const priced = await priceCart({ userId: input.userId, address: input.address });
    return { ...priced, cartId: null, savedForLater: [], note: null };
  }

  const [priced, saved, row] = await Promise.all([
    priceCart({
      cartId: cart.id,
      userId: input.userId,
      address: input.address,
      couponCode: cart.couponCode,
      cod: input.cod,
      walletRequested: input.walletRequested,
      loyaltyPointsRequested: input.loyaltyPointsRequested,
    }),
    loadSavedForLater(cart.id),
    db.cart.findUnique({ where: { id: cart.id }, select: { note: true } }),
  ]);

  return { ...priced, cartId: cart.id, savedForLater: saved, note: row?.note ?? null };
}

async function loadSavedForLater(cartId: string): Promise<SavedLine[]> {
  const items = await db.cartItem.findMany({
    where: { cartId, savedForLater: true },
    orderBy: { addedAt: 'desc' },
    select: {
      id: true,
      variantId: true,
      variant: {
        select: {
          size: true,
          color: true,
          priceDelta: true,
          stock: true,
          reserved: true,
          active: true,
          product: {
            select: {
              name: true,
              slug: true,
              basePrice: true,
              status: true,
              images: {
                where: { kind: 'gallery' },
                orderBy: { sortOrder: 'asc' },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      },
    },
  });

  return items.map((item) => ({
    itemId: item.id,
    variantId: item.variantId,
    productName: item.variant.product.name,
    productSlug: item.variant.product.slug,
    size: item.variant.size,
    color: item.variant.color,
    imageUrl: item.variant.product.images[0]?.url ?? null,
    unitPrice: item.variant.product.basePrice + item.variant.priceDelta,
    inStock:
      item.variant.active &&
      item.variant.product.status === 'active' &&
      sellableOf(item.variant) > 0,
  }));
}

/** Item count for the header badge — one cheap query, no pricing. */
export async function cartCount(userId: string | null): Promise<number> {
  const cart = await findCart(userId);
  if (!cart) return 0;
  const rows = await db.cartItem.aggregate({
    where: { cartId: cart.id, savedForLater: false },
    _sum: { qty: true },
  });
  return rows._sum.qty ?? 0;
}

// ── Abandonment ─────────────────────────────────────────────────────────────

/**
 * Mark carts idle past the threshold as abandoned, so recovery emails can go out.
 *
 * Only carts with an identity (a user, or an email captured at checkout) are
 * recorded — there is nowhere to send a nudge for an anonymous one, and creating
 * rows we can never act on just inflates the table.
 *
 * Called from the marketing cron. Idempotent: an existing unrecovered record is
 * left alone rather than duplicated.
 */
export async function sweepAbandonedCarts(idleMinutes = 60): Promise<{ marked: number }> {
  const cutoff = addMinutes(new Date(), -idleMinutes);

  const candidates = await db.cart.findMany({
    where: {
      status: 'active',
      lastActivityAt: { lt: cutoff },
      userId: { not: null },
      items: { some: { savedForLater: false } },
      abandoned: null,
    },
    take: 200,
    select: {
      id: true,
      userId: true,
      user: { select: { email: true, phone: true } },
      items: {
        where: { savedForLater: false },
        select: { qty: true, priceSnapshot: true },
      },
    },
  });

  let marked = 0;
  for (const cart of candidates) {
    const value = cart.items.reduce((a, i) => a + i.priceSnapshot * i.qty, 0);
    const itemCount = cart.items.reduce((a, i) => a + i.qty, 0);
    if (itemCount === 0) continue;

    await db.abandonedCart.create({
      data: {
        cartId: cart.id,
        userId: cart.userId,
        email: cart.user?.email ?? null,
        phone: cart.user?.phone ?? null,
        value,
        itemCount,
      },
    });
    marked++;
  }

  return { marked };
}
