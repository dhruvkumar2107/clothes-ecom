import { db, tx, type PrismaTx } from '../db';
import { ApiFailure } from '../api';
import { clampToZero, type Paise } from '../money';
import { getSettings } from '../settings';
import { addDays } from '../utils';
import { canTransitionOrder, type OrderStatus, type Courier } from '../enums';
import { releaseReservation, restock } from '../inventory';
import { reverseRedemption } from '../coupons';
import { credit as walletCredit } from '../wallet';
import { reverseForOrder } from '../referral/commission';

/**
 * Order state transitions.
 *
 * Every status change in the system funnels through `transitionOrder`. That is
 * the point: the side effects of a status change are not optional extras a
 * caller might forget. Cancelling has to release stock, return the wallet money,
 * unburn the coupon, and reverse the referral accrual — a route handler that
 * only wrote `status: 'cancelled'` would leave four kinds of corruption behind.
 *
 * ── Why the transition table is enforced, not advisory ─────────────────────
 *
 * `ORDER_TRANSITIONS` in enums.ts is the whole legal graph. Rejecting an illegal
 * jump is not pedantry: `pending → delivered` would skip the inventory commit,
 * so the goods would leave the warehouse while the stock count still showed them
 * reserved. Refusing the transition surfaces the bug at the source instead of
 * six weeks later during a stock audit.
 *
 * ── Inventory: release vs restock ──────────────────────────────────────────
 *
 * These are different operations and picking the wrong one silently loses or
 * invents stock:
 *
 *   • Cancelled *before* payment — the units were only ever **reserved**, so
 *     the hold is released. Physical stock never moved.
 *   • Cancelled *after* payment — the reservation was already committed to a
 *     real decrement, so the units must be **restocked**.
 *
 * The discriminator is `paymentStatus`, since that is what `confirmOrderPaid`
 * uses to decide whether to commit.
 */

export type Actor = {
  type: 'customer' | 'admin' | 'system' | 'courier';
  id?: string | null;
  name?: string | null;
};

/**
 * The inventory ledger has a narrower vocabulary than the order timeline — it
 * only cares who moved stock, and a courier scan is a system event to it.
 */
function inventoryActor(type: Actor['type']): 'customer' | 'system' | 'staff' {
  if (type === 'admin') return 'staff';
  if (type === 'customer') return 'customer';
  return 'system';
}

export interface TransitionOptions {
  actor: Actor;
  /** Shown to the customer in the timeline. A default is derived per status. */
  title?: string;
  description?: string | null;
  location?: string | null;
  /** Internal-only events (fraud review notes, retries) stay hidden. */
  customerVisible?: boolean;
  /** Skip the legality check. Admin override only — logs loudly. */
  force?: boolean;
}

const DEFAULT_TITLES: Record<OrderStatus, string> = {
  pending: 'Order placed',
  confirmed: 'Order confirmed',
  packed: 'Packed and ready to ship',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Order cancelled',
  returned: 'Returned',
};

export interface TransitionResult {
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
  /** Human summary of what the side effects did, for admin toasts and logs. */
  effects: string[];
}

export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  options: TransitionOptions,
): Promise<TransitionResult> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, orderNumber: true },
  });
  if (!order) throw new ApiFailure('not_found', 'Order not found.', 404);

  const from = order.status as OrderStatus;
  if (from === to) {
    // Idempotent by design — a double-clicked admin button or a courier webhook
    // replay should not be an error.
    return { orderId, from, to, effects: ['no change'] };
  }

  if (!canTransitionOrder(from, to)) {
    if (!options.force) {
      throw new ApiFailure(
        'illegal_transition',
        `An order that is ${from} cannot become ${to}.`,
        409,
        undefined,
        { from, to },
      );
    }
    console.warn(
      `[orders] forced illegal transition ${from} → ${to} on ${order.orderNumber} by ${options.actor.type}:${options.actor.id ?? '-'}`,
    );
  }

  switch (to) {
    case 'cancelled':
      return cancelOrder(orderId, { ...options, reason: options.description ?? null });
    case 'delivered':
      return markDelivered(orderId, options);
    default:
      return plainTransition(orderId, from, to, options);
  }
}

/**
 * A status change with no money or stock consequences — `confirmed → packed`,
 * `packed → shipped`. The timeline event is still mandatory: the customer's
 * tracking page is built entirely from OrderEvent rows, so a silent status
 * change looks to them like nothing happened.
 */
async function plainTransition(
  orderId: string,
  from: OrderStatus,
  to: OrderStatus,
  options: TransitionOptions,
): Promise<TransitionResult> {
  const now = new Date();

  await tx(async (client) => {
    await client.order.update({
      where: { id: orderId },
      data: {
        status: to,
        confirmedAt: to === 'confirmed' ? now : undefined,
        // Fulfilment tracks the physical parcel, which the order status implies
        // for these two steps; returns and partial shipments set it explicitly.
        fulfillmentStatus: to === 'shipped' ? 'fulfilled' : undefined,
      },
    });
    await writeEvent(client, orderId, to, options);
  });

  return { orderId, from, to, effects: [] };
}

// ── Cancellation ────────────────────────────────────────────────────────────

export interface CancelOptions extends TransitionOptions {
  reason?: string | null;
  /**
   * Where the money goes. `wallet` is instant and is what we offer by default
   * for our own cancellations; `source` takes 5–7 banking days but is what a
   * customer is entitled to for a card payment they want reversed.
   */
  refundMode?: 'source' | 'wallet';
}

/**
 * Cancel an order and undo everything it caused.
 *
 * The order of undo operations matters less than their completeness, but they
 * all live in one transaction so a partial cancellation is impossible: an order
 * marked cancelled whose stock was never returned is worse than one that failed
 * to cancel and can be retried.
 *
 * Referral reversal and gateway refunds are the two exceptions — they happen
 * *after* the commit, because the first reads a large graph and the second calls
 * an external API. Neither can be rolled back by a database transaction anyway,
 * and holding a write lock open across a network call to Razorpay is how you get
 * transaction timeouts under load.
 */
export async function cancelOrder(
  orderId: string,
  options: CancelOptions,
): Promise<TransitionResult> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      userId: true,
      paymentStatus: true,
      paymentMethod: true,
      amountPaid: true,
      walletApplied: true,
      grandTotal: true,
      couponCode: true,
      items: {
        select: { id: true, variantId: true, qty: true, cancelledQty: true, name: true },
      },
    },
  });
  if (!order) throw new ApiFailure('not_found', 'Order not found.', 404);

  const from = order.status as OrderStatus;
  if (from === 'cancelled') {
    return { orderId, from, to: 'cancelled', effects: ['already cancelled'] };
  }
  if (from === 'delivered' || from === 'returned') {
    throw new ApiFailure(
      'too_late_to_cancel',
      from === 'delivered'
        ? 'This order has already been delivered. Please raise a return instead.'
        : 'This order has already been returned.',
      409,
    );
  }
  if (!canTransitionOrder(from, 'cancelled') && !options.force) {
    throw new ApiFailure(
      'illegal_transition',
      `An order that is ${from} cannot be cancelled.`,
      409,
    );
  }

  const effects: string[] = [];
  const stockLines = order.items
    .map((i) => ({ variantId: i.variantId, qty: i.qty - i.cancelledQty }))
    .filter((l) => l.qty > 0);

  // Money already collected through the gateway, as opposed to from the wallet.
  const gatewayPaid = clampToZero(order.amountPaid - order.walletApplied);
  const refundMode: 'source' | 'wallet' =
    options.refundMode ?? (options.actor.type === 'customer' ? 'source' : 'wallet');

  const now = new Date();
  const loyaltyRefund = await tx(async (client) => {
    // ── Inventory ──
    if (stockLines.length > 0) {
      const committed = order.paymentStatus === 'paid' || order.paymentStatus === 'partially_paid';
      if (committed) {
        await restock(
          stockLines,
          {
            reason: 'cancel',
            refType: 'order',
            refId: order.id,
            note: `Cancelled ${order.orderNumber}`,
            actorType: inventoryActor(options.actor.type),
            actorId: options.actor.id ?? undefined,
          },
          client,
        );
        effects.push(`restocked ${stockLines.length} line(s)`);
      } else {
        await releaseReservation(
          stockLines,
          {
            refType: 'order',
            refId: order.id,
            note: `Cancelled ${order.orderNumber}`,
            actorType: inventoryActor(options.actor.type),
            actorId: options.actor.id ?? undefined,
          },
          client,
        );
        effects.push(`released ${stockLines.length} hold(s)`);
      }
    }

    // ── Wallet money returns immediately ──
    // This was our own currency, so there is no gateway round-trip and no reason
    // to make the customer wait for it.
    if (order.walletApplied > 0) {
      await walletCredit(
        {
          userId: order.userId,
          amount: order.walletApplied,
          type: 'refund',
          description: `Cancelled ${order.orderNumber} — wallet amount returned`,
          refType: 'order',
          refId: order.id,
          idempotent: true,
        },
        client,
      );
      effects.push(`returned ₹${(order.walletApplied / 100).toFixed(2)} to wallet`);
    }

    // ── Loyalty points spent on this order come back ──
    const redemptions = await client.loyaltyTransaction.findMany({
      where: { orderId: order.id, direction: 'debit', reason: 'redemption' },
      select: { points: true },
    });
    const pointsBack = redemptions.reduce((sum, r) => sum + r.points, 0);
    if (pointsBack > 0) {
      const user = await client.user.update({
        where: { id: order.userId },
        data: { loyaltyPoints: { increment: pointsBack } },
        select: { loyaltyPoints: true },
      });
      await client.loyaltyTransaction.create({
        data: {
          userId: order.userId,
          points: pointsBack,
          direction: 'credit',
          reason: 'redemption_reversed',
          orderId: order.id,
          balanceAfter: user.loyaltyPoints,
        },
      });
      effects.push(`returned ${pointsBack} points`);
    }

    // ── Points *earned* on this order are taken back ──
    // Keeping them would let a customer farm points by ordering and cancelling.
    const earned = await client.loyaltyTransaction.findMany({
      where: { orderId: order.id, direction: 'credit', reason: 'order' },
      select: { points: true },
    });
    const pointsClawback = earned.reduce((sum, r) => sum + r.points, 0);
    if (pointsClawback > 0) {
      const user = await client.user.update({
        where: { id: order.userId },
        // Clamped in SQL is not available, so read-then-write inside the txn.
        data: { loyaltyPoints: { decrement: pointsClawback } },
        select: { loyaltyPoints: true },
      });
      const corrected = Math.max(0, user.loyaltyPoints);
      if (corrected !== user.loyaltyPoints) {
        await client.user.update({
          where: { id: order.userId },
          data: { loyaltyPoints: corrected },
        });
      }
      await client.loyaltyTransaction.create({
        data: {
          userId: order.userId,
          points: pointsClawback,
          direction: 'debit',
          reason: 'order_cancelled',
          orderId: order.id,
          balanceAfter: corrected,
        },
      });
      effects.push(`clawed back ${pointsClawback} earned points`);
    }

    // ── Lifetime stats ──
    // Only if the order had counted in the first place, i.e. it was paid.
    if (order.paymentStatus === 'paid') {
      await client.user.update({
        where: { id: order.userId },
        data: {
          orderCount: { decrement: 1 },
          lifetimeSpend: { decrement: order.grandTotal },
        },
      });
    }

    // ── The order itself ──
    await client.order.update({
      where: { id: order.id },
      data: {
        status: 'cancelled',
        fulfillmentStatus: 'unfulfilled',
        cancelledAt: now,
        cancelReason: options.reason?.slice(0, 300) ?? null,
        cancelledBy: options.actor.type,
        amountDue: 0,
      },
    });
    await client.orderItem.updateMany({
      where: { orderId: order.id },
      data: { fulfillmentStatus: 'cancelled' },
    });

    await writeEvent(client, order.id, 'cancelled', {
      ...options,
      title: options.title ?? 'Order cancelled',
      description:
        options.description ??
        options.reason ??
        (options.actor.type === 'customer' ? 'Cancelled at your request.' : null),
    });

    // ── Refund record for gateway money ──
    // Created as `pending` here and driven to completion by payments.ts, so the
    // customer's refund page shows something the moment they cancel rather than
    // after the gateway responds.
    if (gatewayPaid > 0) {
      await client.refund.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          amount: gatewayPaid,
          mode: refundMode,
          status: 'pending',
          reason: options.reason?.slice(0, 300) ?? 'Order cancelled',
          initiatedBy: options.actor.type === 'customer' ? 'customer' : 'admin',
        },
      });
      await client.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: 'refunded',
        },
      });
      effects.push(
        `refund of ₹${(gatewayPaid / 100).toFixed(2)} queued to ${refundMode === 'wallet' ? 'wallet' : 'source'}`,
      );
    }

    return pointsBack;
  });

  void loyaltyRefund;

  // ── Post-commit, non-transactional undo ──

  if (order.couponCode) {
    await reverseRedemption(order.id).catch((e) =>
      console.error(`[orders] coupon reversal failed for ${order.orderNumber}:`, e),
    );
    effects.push(`released coupon ${order.couponCode}`);
  }

  const reversed = await reverseForOrder(order.id, 'order_cancelled').catch((e) => {
    console.error(`[orders] referral reversal failed for ${order.orderNumber}:`, e);
    return null;
  });
  if (reversed) effects.push('reversed referral commission');

  return { orderId: order.id, from, to: 'cancelled', effects };
}

// ── Delivery ────────────────────────────────────────────────────────────────

/**
 * Mark delivered.
 *
 * This is the commercially significant moment, not shipping: it starts the return
 * window, it makes a COD order paid, and it is the event referral commissions
 * are held against. `deliveredAt` therefore has to be the real delivery time
 * where the courier gives us one, not "when the webhook arrived" — an eight-hour
 * discrepancy at a month boundary moves a return deadline by a day.
 */
export async function markDelivered(
  orderId: string,
  options: TransitionOptions & { deliveredAt?: Date },
): Promise<TransitionResult> {
  const settings = await getSettings(['checkout.returnWindowDays']);

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      userId: true,
      paymentStatus: true,
      paymentMethod: true,
      grandTotal: true,
      amountPaid: true,
      walletApplied: true,
    },
  });
  if (!order) throw new ApiFailure('not_found', 'Order not found.', 404);

  const from = order.status as OrderStatus;
  if (from === 'delivered') {
    return { orderId, from, to: 'delivered', effects: ['already delivered'] };
  }
  if (!canTransitionOrder(from, 'delivered') && !options.force) {
    throw new ApiFailure(
      'illegal_transition',
      `An order that is ${from} cannot be marked delivered.`,
      409,
    );
  }

  const deliveredAt = options.deliveredAt ?? new Date();
  const effects: string[] = [];

  // A COD parcel is paid at the door. The delivery event *is* the payment
  // confirmation, so recording delivery without recording payment would leave a
  // permanently unpaid order that reconciliation flags forever.
  const codCollected =
    order.paymentMethod === 'cod' && order.paymentStatus !== 'paid'
      ? clampToZero(order.grandTotal - order.amountPaid)
      : 0;

  await tx(async (client) => {
    await client.order.update({
      where: { id: order.id },
      data: {
        status: 'delivered',
        fulfillmentStatus: 'fulfilled',
        deliveredAt,
        returnWindowEndsAt: addDays(deliveredAt, settings['checkout.returnWindowDays']),
        ...(codCollected > 0
          ? {
              amountPaid: order.amountPaid + codCollected,
              amountDue: 0,
              paymentStatus: 'paid',
            }
          : {}),
      },
    });
    await client.orderItem.updateMany({
      where: { orderId: order.id },
      data: { fulfillmentStatus: 'fulfilled' },
    });

    await writeEvent(client, order.id, 'delivered', {
      ...options,
      title: options.title ?? 'Delivered',
      description:
        options.description ??
        (codCollected > 0
          ? `₹${(codCollected / 100).toFixed(2)} collected on delivery.`
          : 'Your parcel has been delivered.'),
    });

    if (codCollected > 0) {
      await client.orderEvent.create({
        data: {
          orderId: order.id,
          status: 'delivered',
          title: 'Payment collected',
          description: `₹${(codCollected / 100).toFixed(2)} received in cash.`,
          actorType: 'courier',
          customerVisible: true,
        },
      });
      effects.push(`recorded COD collection of ₹${(codCollected / 100).toFixed(2)}`);
    }
  });

  // COD orders only commit their inventory and earn their loyalty at delivery,
  // since that is when the money exists. Prepaid orders did this at payment.
  if (codCollected > 0) {
    const { confirmOrderPaid } = await import('./create');
    await confirmOrderPaid({
      orderId: order.id,
      amount: 0, // already recorded above; this call performs the side effects
      method: 'cod',
      reference: 'Collected on delivery',
    }).catch((e) => console.error(`[orders] COD confirm side-effects failed:`, e));
  }

  return { orderId: order.id, from, to: 'delivered', effects };
}

// ── Shipment ────────────────────────────────────────────────────────────────

export interface ShipInput {
  orderId: string;
  courier: Courier;
  courierName?: string | null;
  awb?: string | null;
  trackingUrl?: string | null;
  labelUrl?: string | null;
  weightGrams?: number;
  charges?: Paise;
  providerShipmentId?: string | null;
  actor: Actor;
}

/**
 * Create a shipment and move the order to `shipped`.
 *
 * The Shipment row is separate from the order because one order can ship in two
 * parcels (a pre-order item following the rest), and because courier tracking
 * events have their own lifecycle that would otherwise pollute the order
 * timeline with "in transit at Bhiwandi hub" noise.
 */
export async function shipOrder(input: ShipInput): Promise<{
  shipmentId: string;
  awb: string | null;
}> {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, status: true, orderNumber: true },
  });
  if (!order) throw new ApiFailure('not_found', 'Order not found.', 404);

  if (order.status !== 'packed' && order.status !== 'confirmed') {
    throw new ApiFailure(
      'not_ready_to_ship',
      `An order that is ${order.status} cannot be shipped.`,
      409,
    );
  }

  return tx(async (client) => {
    const shipment = await client.shipment.create({
      data: {
        orderId: order.id,
        courier: input.courier,
        courierName: input.courierName ?? null,
        awb: input.awb ?? null,
        trackingUrl: input.trackingUrl ?? null,
        labelUrl: input.labelUrl ?? null,
        weightGrams: input.weightGrams ?? 500,
        charges: input.charges ?? 0,
        providerShipmentId: input.providerShipmentId ?? null,
        status: 'created',
        shippedAt: new Date(),
        events: {
          create: {
            status: 'created',
            message: input.awb
              ? `Shipment created with ${input.courierName ?? input.courier}. AWB ${input.awb}.`
              : `Shipment created with ${input.courierName ?? input.courier}.`,
          },
        },
      },
      select: { id: true, awb: true },
    });

    await client.order.update({
      where: { id: order.id },
      data: { status: 'shipped', fulfillmentStatus: 'fulfilled' },
    });

    await writeEvent(client, order.id, 'shipped', {
      actor: input.actor,
      title: 'Shipped',
      description: input.awb
        ? `On its way with ${input.courierName ?? input.courier}. Tracking: ${input.awb}`
        : `Handed to ${input.courierName ?? input.courier}.`,
      customerVisible: true,
    });

    return { shipmentId: shipment.id, awb: shipment.awb };
  });
}

/**
 * Record a courier tracking update.
 *
 * Called by webhooks and by the polling job, so it must tolerate replays and
 * out-of-order arrival — couriers deliver "out for delivery" after "delivered"
 * more often than you would like. Terminal statuses therefore win: once a
 * shipment is delivered, a later in-transit event is stored as history but does
 * not move the status backwards.
 */
export async function recordShipmentEvent(input: {
  shipmentId?: string;
  awb?: string;
  status: string;
  message: string;
  location?: string | null;
  occurredAt?: Date;
  /** Propagate delivery to the order. Off for intermediate scans. */
  propagate?: boolean;
}): Promise<{ shipmentId: string; orderStatusChanged: boolean }> {
  const shipment = input.shipmentId
    ? await db.shipment.findUnique({
        where: { id: input.shipmentId },
        select: { id: true, status: true, orderId: true },
      })
    : input.awb
      ? await db.shipment.findUnique({
          where: { awb: input.awb },
          select: { id: true, status: true, orderId: true },
        })
      : null;

  if (!shipment) throw new ApiFailure('not_found', 'Shipment not found.', 404);

  const TERMINAL = new Set(['delivered', 'rto', 'lost']);
  const alreadyTerminal = TERMINAL.has(shipment.status);

  await db.shipmentEvent.create({
    data: {
      shipmentId: shipment.id,
      status: input.status,
      message: input.message,
      location: input.location ?? null,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });

  if (!alreadyTerminal) {
    await db.shipment.update({
      where: { id: shipment.id },
      data: {
        status: input.status,
        deliveredAt: input.status === 'delivered' ? (input.occurredAt ?? new Date()) : undefined,
      },
    });
  }

  let orderStatusChanged = false;
  if (input.status === 'delivered' && !alreadyTerminal && input.propagate !== false) {
    await markDelivered(shipment.orderId, {
      actor: { type: 'courier' },
      description: input.message,
      location: input.location,
      deliveredAt: input.occurredAt,
    }).then(
      () => {
        orderStatusChanged = true;
      },
      (e) => console.error(`[orders] delivery propagation failed:`, e),
    );
  }

  // An RTO is a delivery failure, not a customer return — the parcel comes back
  // to us unopened. The order is cancelled and the money refunded, because the
  // customer never received anything.
  if (input.status === 'rto' && !alreadyTerminal) {
    await cancelOrder(shipment.orderId, {
      actor: { type: 'system' },
      reason: 'Returned to origin by courier',
      refundMode: 'wallet',
      force: true,
      title: 'Returned to origin',
      description: input.message,
    }).then(
      () => {
        orderStatusChanged = true;
      },
      (e) => console.error(`[orders] RTO handling failed:`, e),
    );
  }

  return { shipmentId: shipment.id, orderStatusChanged };
}

// ── Events ──────────────────────────────────────────────────────────────────

async function writeEvent(
  client: PrismaTx,
  orderId: string,
  status: OrderStatus,
  options: TransitionOptions,
): Promise<void> {
  await client.orderEvent.create({
    data: {
      orderId,
      status,
      title: options.title ?? DEFAULT_TITLES[status],
      description: options.description ?? null,
      location: options.location ?? null,
      actorType: options.actor.type,
      actorId: options.actor.id ?? null,
      customerVisible: options.customerVisible ?? true,
    },
  });
}

/**
 * Add a note to the timeline without changing status — "your parcel is delayed
 * due to rain in Mumbai". Customer-visible by default because the whole point of
 * these is to pre-empt a "where is my order" ticket.
 */
export async function addOrderNote(input: {
  orderId: string;
  title: string;
  description?: string | null;
  actor: Actor;
  customerVisible?: boolean;
}): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    select: { status: true },
  });
  if (!order) throw new ApiFailure('not_found', 'Order not found.', 404);

  await db.orderEvent.create({
    data: {
      orderId: input.orderId,
      status: order.status,
      title: input.title.slice(0, 120),
      description: input.description?.slice(0, 1000) ?? null,
      actorType: input.actor.type,
      actorId: input.actor.id ?? null,
      customerVisible: input.customerVisible ?? true,
    },
  });
}

// ── Bulk operations ─────────────────────────────────────────────────────────

export interface BulkResult {
  ok: string[];
  failed: { orderId: string; message: string }[];
}

/**
 * Move many orders at once, from the admin list's checkbox toolbar.
 *
 * Runs sequentially and collects failures rather than aborting: an operator who
 * selected 40 orders and hit "mark packed" wants the 38 that could move to have
 * moved, plus a precise list of the two that could not.
 */
export async function bulkTransition(
  orderIds: readonly string[],
  to: OrderStatus,
  options: TransitionOptions,
): Promise<BulkResult> {
  const result: BulkResult = { ok: [], failed: [] };

  for (const orderId of orderIds) {
    try {
      await transitionOrder(orderId, to, options);
      result.ok.push(orderId);
    } catch (cause) {
      result.failed.push({
        orderId,
        message: cause instanceof Error ? cause.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Auto-cancel stale unpaid orders.
 *
 * An abandoned payment page holds its stock reservation indefinitely otherwise,
 * which is how a sold-out product ends up with 40 phantom units held by carts
 * nobody will ever complete. Run from the cron route.
 */
export async function expireUnpaidOrders(
  olderThanMinutes = 60,
): Promise<{ cancelled: number; failed: number }> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);

  const stale = await db.order.findMany({
    where: {
      status: 'pending',
      paymentStatus: 'unpaid',
      // COD orders are not awaiting payment, so they never expire this way.
      paymentMethod: { not: 'cod' },
      placedAt: { lt: cutoff },
    },
    select: { id: true },
    take: 200,
  });

  let cancelled = 0;
  let failed = 0;

  for (const order of stale) {
    try {
      await cancelOrder(order.id, {
        actor: { type: 'system' },
        reason: 'Payment not completed in time',
        title: 'Order expired',
        description: 'This order was cancelled because payment was not completed.',
      });
      cancelled += 1;
    } catch (cause) {
      failed += 1;
      console.error(`[orders] failed to expire ${order.id}:`, cause);
    }
  }

  return { cancelled, failed };
}
