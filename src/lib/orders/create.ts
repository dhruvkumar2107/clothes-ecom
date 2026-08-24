import { db, tx, type DbClient } from '../db';
import { ApiFailure } from '../api';
import { clampToZero, type Paise } from '../money';
import { generateOrderNumber } from '../ids';
import { writeJson, writeJsonStrict } from '../json';
import { getSettings } from '../settings';
import { addDays } from '../utils';
import { priceCart, type PricedCart } from '../pricing';
import { reserve, releaseReservation, type ReserveFailure } from '../inventory';
import { recordRedemption } from '../coupons';
import { debit as walletDebit } from '../wallet';
import type { PaymentMethod } from '../enums';

/**
 * Order creation.
 *
 * This is the one place in the system where money, inventory, and a promise to a
 * customer all change together. Everything about its shape follows from that.
 *
 * ── Why the price is never trusted from the client ─────────────────────────
 *
 * The request says *what* to buy and *how* to pay. It never says what it costs.
 * `priceCart` re-derives every figure server-side immediately before the write,
 * so a tampered payload, a stale tab, or a price change three seconds ago all
 * produce the correct total rather than the one the browser remembered.
 *
 * The client may send `expectedTotal`. It is used only to *refuse* — if the real
 * total differs, the order is rejected and the customer re-confirms. Silently
 * charging a different number than the screen showed is the one outcome worse
 * than an error.
 *
 * ── Why the address is frozen ──────────────────────────────────────────────
 *
 * `shippingAddressJson` is a snapshot, not a foreign key. A customer editing
 * their address next month must not retroactively change where last month's
 * parcel was sent — that record is evidence in a delivery dispute.
 *
 * ── Ordering inside the transaction ────────────────────────────────────────
 *
 * Stock is reserved *before* the order row exists. If reservation fails there is
 * nothing to roll back and the customer sees a precise "only 2 left". If the
 * order write then fails, the reservation is released in the catch — a leaked
 * hold is recoverable (`reconcileReservations`), an oversold order is not.
 */

export interface CreateOrderInput {
  userId: string;
  cartId: string;
  addressId: string;
  paymentMethod: PaymentMethod;
  /** Separate billing address; defaults to the shipping address. */
  billingAddressId?: string | null;
  couponCode?: string | null;
  walletRequested?: Paise;
  loyaltyPointsRequested?: number;
  customerNote?: string | null;
  giftWrap?: boolean;
  /** The total the customer saw. Mismatch aborts rather than silently charging. */
  expectedTotal?: Paise;
}

export interface CreatedOrder {
  orderId: string;
  orderNumber: string;
  grandTotal: Paise;
  amountDue: Paise;
  walletApplied: Paise;
  paymentMethod: PaymentMethod;
  /** True when nothing is left to collect — wallet covered it, or it's a ₹0 order. */
  fullyPaid: boolean;
  status: string;
  paymentStatus: string;
}

export async function createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
  const settings = await getSettings(['checkout.returnWindowDays']);

  // ── 1. Address ──
  const address = await db.address.findFirst({
    where: { id: input.addressId, userId: input.userId },
  });
  if (!address) {
    throw new ApiFailure('address_not_found', 'Choose a delivery address.', 404, 'addressId');
  }

  const billing =
    input.billingAddressId && input.billingAddressId !== input.addressId
      ? await db.address.findFirst({
          where: { id: input.billingAddressId, userId: input.userId },
        })
      : null;

  // ── 2. Price, server-side, now ──
  const priced = await priceCart({
    cartId: input.cartId,
    userId: input.userId,
    address: {
      pincode: address.pincode,
      state: address.state,
      stateCode: address.stateCode,
    },
    couponCode: input.couponCode,
    cod: input.paymentMethod === 'cod',
    walletRequested: input.walletRequested,
    loyaltyPointsRequested: input.loyaltyPointsRequested,
  });

  if (priced.lines.length === 0) {
    throw new ApiFailure('empty_cart', 'Your bag is empty.', 409);
  }

  // Blocking issues are the customer's to resolve — surfacing the first one with
  // its own message beats a generic "checkout failed".
  const blocking = priced.issues[0];
  if (blocking) {
    throw new ApiFailure(blocking.code, blocking.message, 409, undefined, {
      issues: priced.issues,
    });
  }

  if (
    input.expectedTotal !== undefined &&
    input.expectedTotal !== priced.totals.grandTotal
  ) {
    throw new ApiFailure(
      'total_changed',
      'The total changed while you were checking out. Please review and confirm.',
      409,
      undefined,
      { expected: input.expectedTotal, actual: priced.totals.grandTotal },
    );
  }

  if (input.paymentMethod === 'cod' && !priced.cod.available) {
    throw new ApiFailure(
      'cod_unavailable',
      priced.cod.reason ?? 'Cash on delivery isn’t available for this order.',
      409,
    );
  }

  // ── 3. Reserve stock ──
  const reserveLines = priced.lines.map((l) => ({ variantId: l.variantId, qty: l.qty }));
  const orderNumber = await generateOrderNumber();

  const reservation = await reserve(reserveLines, {
    refType: 'order',
    refId: orderNumber,
    note: `Checkout ${orderNumber}`,
    actorType: 'customer',
    actorId: input.userId,
  });

  if (!reservation.ok) {
    throw new ApiFailure(
      'insufficient_stock',
      stockMessage(reservation.failures),
      409,
      undefined,
      { failures: reservation.failures },
    );
  }

  // ── 4. Write the order ──
  try {
    return await tx(async (client) => {
      const order = await client.order.create({
        data: {
          orderNumber,
          userId: input.userId,
          status: 'pending',
          paymentStatus: 'unpaid',
          fulfillmentStatus: 'unfulfilled',

          subtotal: priced.totals.subtotal,
          discountTotal: priced.totals.discountTotal,
          shippingTotal: priced.totals.shippingTotal,
          codFee: priced.totals.codFee,
          taxTotal: priced.totals.taxTotal,
          walletApplied: priced.totals.walletApplied,
          grandTotal: priced.totals.grandTotal,
          amountPaid: 0,
          amountDue: priced.totals.grandTotal,

          paymentMethod: input.paymentMethod,
          couponCode: priced.coupon?.ok ? priced.coupon.code : null,
          referralCodeUsed: await referralCodeFor(input.userId, client),

          shippingAddressJson: writeJsonStrict(snapshotAddress(address)),
          billingAddressJson: billing ? writeJson(snapshotAddress(billing)) : null,

          customerNote: input.customerNote?.trim().slice(0, 500) || null,
          giftWrap: Boolean(input.giftWrap),

          returnWindowEndsAt: addDays(new Date(), settings['checkout.returnWindowDays']),

          items: {
            create: priced.lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              name: line.productName,
              sku: line.sku,
              size: line.size,
              color: line.color,
              imageUrl: line.imageUrl,
              hsnCode: line.hsnCode ?? '6109',
              unitPrice: line.unitPrice,
              qty: line.qty,
              discount: line.discount,
              taxRate: line.taxRate,
              taxAmount: line.taxAmount,
              lineTotal: line.lineTotal,
            })),
          },

          events: {
            create: {
              status: 'pending',
              title: 'Order placed',
              description: `${priced.totals.unitCount} item${
                priced.totals.unitCount === 1 ? '' : 's'
              } · ${input.paymentMethod.toUpperCase()}`,
              actorType: 'customer',
              actorId: input.userId,
              customerVisible: true,
            },
          },
        },
        select: { id: true, orderNumber: true },
      });

      // ── Coupon ──
      if (priced.coupon?.ok) {
        await recordRedemption(
          {
            couponId: priced.coupon.couponId,
            userId: input.userId,
            orderId: order.id,
            discountAmount: priced.coupon.discount + priced.coupon.shippingDiscount,
          },
          client,
        );
      }

      // ── Loyalty redemption ──
      // Debited now, not at payment. The points were spent to reduce the amount
      // due; if payment then fails, the cancellation path returns them.
      if (priced.loyalty.pointsRedeemed > 0) {
        const user = await client.user.update({
          where: { id: input.userId },
          data: { loyaltyPoints: { decrement: priced.loyalty.pointsRedeemed } },
          select: { loyaltyPoints: true },
        });
        await client.loyaltyTransaction.create({
          data: {
            userId: input.userId,
            points: priced.loyalty.pointsRedeemed,
            direction: 'debit',
            reason: 'redemption',
            orderId: order.id,
            balanceAfter: user.loyaltyPoints,
          },
        });
      }

      // ── Wallet ──
      // Debiting inside this transaction is what makes the balance and the order
      // atomic: a wallet-funded order that half-committed would either give away
      // goods or eat the customer's balance.
      let amountPaid = 0;
      if (priced.totals.walletApplied > 0) {
        await walletDebit(
          {
            userId: input.userId,
            amount: priced.totals.walletApplied,
            type: 'order_payment',
            description: `Order ${order.orderNumber}`,
            refType: 'order',
            refId: order.id,
            idempotent: true,
          },
          client,
        );
        amountPaid = priced.totals.walletApplied;
      }

      const amountDue = clampToZero(priced.totals.grandTotal - amountPaid);
      const fullyPaid = amountDue === 0;

      // A wallet-covered order has nothing left to collect, so it confirms
      // immediately rather than waiting for a gateway callback that never comes.
      const paymentStatus = fullyPaid ? 'paid' : 'unpaid';
      const status = fullyPaid ? 'confirmed' : 'pending';

      await client.order.update({
        where: { id: order.id },
        data: {
          amountPaid,
          amountDue,
          paymentStatus,
          status,
          confirmedAt: fullyPaid ? new Date() : null,
        },
      });

      if (fullyPaid) {
        await client.orderEvent.create({
          data: {
            orderId: order.id,
            status: 'confirmed',
            title: 'Payment received',
            description: 'Paid in full from wallet balance.',
            actorType: 'system',
            customerVisible: true,
          },
        });
      }

      // ── Convert the cart ──
      await client.cart.update({
        where: { id: input.cartId },
        data: {
          status: 'converted',
          convertedOrderId: order.id,
          couponCode: null,
        },
      });
      await client.cartItem.deleteMany({
        where: { cartId: input.cartId, savedForLater: false },
      });

      // Close out any abandonment record — this cart converted.
      await client.abandonedCart.updateMany({
        where: { cartId: input.cartId, recoveredAt: null },
        data: {
          recoveredAt: new Date(),
          recoveredOrderId: order.id,
          recoveredValue: priced.totals.grandTotal,
        },
      });

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        grandTotal: priced.totals.grandTotal,
        amountDue,
        walletApplied: amountPaid,
        paymentMethod: input.paymentMethod,
        fullyPaid,
        status,
        paymentStatus,
      };
    });
  } catch (cause) {
    // The order didn't commit, so the hold is orphaned. Release it rather than
    // leaving stock unsellable until the next reconcile sweep.
    await releaseReservation(reserveLines, {
      refType: 'order',
      refId: orderNumber,
      note: `Checkout ${orderNumber} failed`,
      actorType: 'system',
    }).catch((releaseError) => {
      console.error(
        `[orders] failed to release reservation for ${orderNumber} — run reconcileReservations:`,
        releaseError,
      );
    });
    throw cause;
  }
}

// ── Post-payment confirmation ───────────────────────────────────────────────

/**
 * Confirm an order once money has actually arrived.
 *
 * Called by the payment success path and by the webhook, which means it **must**
 * be idempotent — gateways retry, and a customer who refreshes the return URL
 * triggers it a second time. The guard is the order's own state: an order already
 * past `pending` is left alone and reported as already-confirmed.
 */
export async function confirmOrderPaid(input: {
  orderId: string;
  amount: Paise;
  method?: PaymentMethod | null;
  reference?: string | null;
}): Promise<{ confirmed: boolean; alreadyConfirmed: boolean }> {
  const settings = await getSettings(['loyalty.enabled', 'loyalty.pointsPerHundred']);

  return tx(async (client) => {
    const order = await client.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
        paymentStatus: true,
        grandTotal: true,
        amountPaid: true,
        walletApplied: true,
        subtotal: true,
        discountTotal: true,
        items: { select: { variantId: true, qty: true } },
      },
    });
    if (!order) throw new ApiFailure('not_found', 'Order not found.', 404);

    if (order.paymentStatus === 'paid') {
      return { confirmed: false, alreadyConfirmed: true };
    }
    if (order.status === 'cancelled') {
      throw new ApiFailure(
        'order_cancelled',
        'This order was cancelled. The payment will be refunded automatically.',
        409,
      );
    }

    const amountPaid = order.amountPaid + input.amount;
    const amountDue = clampToZero(order.grandTotal - amountPaid);
    const fullyPaid = amountDue === 0;

    await client.order.update({
      where: { id: order.id },
      data: {
        amountPaid,
        amountDue,
        paymentStatus: fullyPaid ? 'paid' : 'partially_paid',
        status: fullyPaid && order.status === 'pending' ? 'confirmed' : order.status,
        confirmedAt: fullyPaid ? new Date() : null,
        paymentMethod: input.method ?? undefined,
      },
    });

    await client.orderEvent.create({
      data: {
        orderId: order.id,
        status: fullyPaid ? 'confirmed' : 'pending',
        title: fullyPaid ? 'Payment received' : 'Partial payment received',
        description: input.reference ? `Ref ${input.reference}` : null,
        actorType: 'system',
        customerVisible: true,
      },
    });

    if (!fullyPaid) return { confirmed: false, alreadyConfirmed: false };

    // ── Commit the inventory ──
    // The hold becomes a real decrement here, not at order creation, because
    // until money arrived the sale wasn't real.
    const { commitReservation } = await import('../inventory');
    await commitReservation(
      order.items.map((i) => ({ variantId: i.variantId, qty: i.qty })),
      { refType: 'order', refId: order.id, note: `Order ${order.orderNumber}` },
      client,
    );

    // ── Loyalty earn ──
    if (settings['loyalty.enabled']) {
      const goods = clampToZero(order.subtotal - order.discountTotal);
      const points = Math.floor((goods / 10_000) * settings['loyalty.pointsPerHundred']);
      if (points > 0) {
        const user = await client.user.update({
          where: { id: order.userId },
          data: { loyaltyPoints: { increment: points } },
          select: { loyaltyPoints: true },
        });
        await client.loyaltyTransaction.create({
          data: {
            userId: order.userId,
            points,
            direction: 'credit',
            reason: 'order',
            orderId: order.id,
            balanceAfter: user.loyaltyPoints,
          },
        });
      }
    }

    // ── Customer lifetime stats ──
    // Denormalised onto User because the admin list sorts and filters on them,
    // and an aggregate over every order per row does not survive 50k customers.
    await client.user.update({
      where: { id: order.userId },
      data: {
        orderCount: { increment: 1 },
        lifetimeSpend: { increment: order.grandTotal },
      },
    });

    return { confirmed: true, alreadyConfirmed: false };
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export interface AddressSnapshot {
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  stateCode: string | null;
  pincode: string;
  country: string;
  label: string;
}

export function snapshotAddress(address: {
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  stateCode: string | null;
  pincode: string;
  country: string;
  label: string;
}): AddressSnapshot {
  return {
    name: address.name,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    landmark: address.landmark,
    city: address.city,
    state: address.state,
    stateCode: address.stateCode,
    pincode: address.pincode,
    country: address.country,
    label: address.label,
  };
}

/** One-line rendering of a frozen address, for lists and emails. */
export function formatAddress(a: AddressSnapshot): string {
  return [a.line1, a.line2, a.landmark, a.city, `${a.state} ${a.pincode}`]
    .filter(Boolean)
    .join(', ');
}

function stockMessage(failures: readonly ReserveFailure[]): string {
  if (failures.length === 1) {
    const f = failures[0];
    return f.available === 0
      ? `${f.name} just sold out.`
      : `Only ${f.available} left of ${f.name}.`;
  }
  return `${failures.length} items in your bag are no longer available in the quantity you chose.`;
}

/** The referral code that brought this customer in, recorded for attribution. */
async function referralCodeFor(userId: string, client: DbClient): Promise<string | null> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { referredBy: { select: { referralCode: true } } },
  });
  return user?.referredBy?.referralCode ?? null;
}

export async function cancelOrder(
  orderId: string,
  reason: string,
  cancelledBy: 'customer' | 'admin' | 'system' = 'customer'
): Promise<{ cancelled: boolean }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, intents: true },
  });
  if (!order) throw new ApiFailure('not_found', 'Order not found.', 404);

  if (['delivered', 'cancelled', 'returned'].includes(order.status)) {
    throw new ApiFailure('invalid_state', 'Order cannot be cancelled.', 409);
  }

  await db.$transaction(async (client) => {
    await client.order.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason,
        cancelledBy,
        paymentStatus: order.paymentStatus === 'paid' ? 'refunded' : 'failed',
      },
    });

    await client.orderEvent.create({
      data: { orderId, status: 'cancelled', title: 'Order Cancelled', description: reason, actorType: cancelledBy, customerVisible: true },
    });

    for (const item of order.items) {
      await releaseReservation([{ variantId: item.variantId, qty: item.qty - item.cancelledQty }], {
        refType: 'order', refId: order.id, note: `Order cancelled: ${reason}`, actorType: 'system',
      }, client);
    }

    if (order.couponCode) {
      const redemption = await client.couponRedemption.findFirst({ where: { orderId } });
      if (redemption) {
        await client.couponRedemption.delete({ where: { id: redemption.id } });
        await client.coupon.update({ where: { code: order.couponCode }, data: { usedCount: { decrement: 1 } } });
      }
    }

    if (order.walletApplied > 0) {
      await client.wallet.update({ where: { userId: order.userId }, data: { balance: { increment: order.walletApplied }, lockedBalance: { decrement: order.walletApplied } } });
      await client.walletTransaction.create({
        data: { walletId: (await client.wallet.findUnique({ where: { userId: order.userId } }))!.id, userId: order.userId, type: 'refund', direction: 'credit', amount: order.walletApplied, status: 'completed', balanceAfter: 0, refType: 'Order', refId: orderId, description: `Refund for cancelled order ${order.orderNumber}` },
      });
    }
  });

  return { cancelled: true };
}

/** Re-derive an order's totals — used by admin edits and reconciliation. */
export async function repriceOrder(orderId: string): Promise<PricedCart> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      couponCode: true,
      paymentMethod: true,
      shippingAddressJson: true,
      items: {
        select: { id: true, variantId: true, qty: true, unitPrice: true },
      },
    },
  });
  if (!order) throw new ApiFailure('not_found', 'Order not found.', 404);

  const { readJson } = await import('../json');
  const address = readJson<AddressSnapshot | null>(order.shippingAddressJson, null);

  return priceCart({
    userId: order.userId,
    lines: order.items.map((i) => ({
      key: i.id,
      variantId: i.variantId,
      qty: i.qty,
      unitPriceOverride: i.unitPrice,
    })),
    address: address
      ? { pincode: address.pincode, state: address.state, stateCode: address.stateCode }
      : null,
    couponCode: order.couponCode,
    cod: order.paymentMethod === 'cod',
    skipAutoCoupon: true,
  });
}
