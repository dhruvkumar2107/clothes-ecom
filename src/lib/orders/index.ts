import { db } from '../db';
import { ApiFailure } from '../api';
import { readJson } from '../json';
import type { Paise } from '../money';
import type { Page, Paginated } from '../api';
import { paginated } from '../api';
import { formatAddress, type AddressSnapshot } from './create';

/**
 * Order reads.
 *
 * Writes live in `create.ts` and `transitions.ts`; this module is the query side.
 * Keeping them apart is not ceremony — the read shapes are shared by the account
 * page, the admin table, the invoice, and the emails, and every one of them
 * previously hand-rolled its own `select`. When `OrderItem.imageUrl` was added,
 * four places had to change. Now one does.
 *
 * ── Authorisation is a query concern here ──────────────────────────────────
 *
 * `getOrderForUser` filters by `userId` in the `where` clause rather than
 * fetching and then comparing. Both work; only one of them is impossible to get
 * wrong later by deleting a line.
 */

export { createOrder, confirmOrderPaid, repriceOrder, snapshotAddress, formatAddress } from './create';
export type { CreateOrderInput, CreatedOrder, AddressSnapshot } from './create';

export { createPaymentIntent } from './payments';
export type { CreatePaymentIntentInput, CreatedPaymentIntent } from './payments';

export {
  transitionOrder,
  cancelOrder,
  markDelivered,
  shipOrder,
  recordShipmentEvent,
  addOrderNote,
  bulkTransition,
  expireUnpaidOrders,
} from './transitions';
export type { Actor, TransitionOptions, TransitionResult, CancelOptions, ShipInput } from './transitions';

// ── Shapes ──────────────────────────────────────────────────────────────────

export interface OrderLineView {
  id: string;
  productId: string | null;
  variantId: string | null;
  name: string;
  sku: string;
  size: string | null;
  color: string | null;
  imageUrl: string | null;
  unitPrice: Paise;
  qty: number;
  discount: Paise;
  taxAmount: Paise;
  lineTotal: Paise;
  fulfillmentStatus: string;
  returnedQty: number;
  cancelledQty: number;
  /** Present when the product still exists, so the UI can link to it. */
  slug: string | null;
  /** Whether this line may still be returned — see `returnableLines`. */
  returnable: boolean;
}

export interface OrderTimelineEntry {
  id: string;
  status: string;
  title: string;
  description: string | null;
  location: string | null;
  at: Date;
  actorType: string;
}

export interface ShipmentView {
  id: string;
  courier: string;
  courierName: string | null;
  awb: string | null;
  trackingUrl: string | null;
  status: string;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  events: { status: string; message: string; location: string | null; at: Date }[];
}

export interface OrderView {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  /** Null until the customer picks one — a cart-stage order has no method yet. */
  paymentMethod: string | null;

  subtotal: Paise;
  discountTotal: Paise;
  shippingTotal: Paise;
  codFee: Paise;
  taxTotal: Paise;
  walletApplied: Paise;
  grandTotal: Paise;
  amountPaid: Paise;
  amountDue: Paise;

  couponCode: string | null;
  giftWrap: boolean;
  customerNote: string | null;

  shippingAddress: AddressSnapshot | null;
  billingAddress: AddressSnapshot | null;
  shippingAddressLine: string;

  placedAt: Date;
  confirmedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  returnWindowEndsAt: Date | null;

  items: OrderLineView[];
  timeline: OrderTimelineEntry[];
  shipments: ShipmentView[];

  /** Derived affordances, so the UI doesn't re-implement the rules. */
  canCancel: boolean;
  canReturn: boolean;
  canPay: boolean;
  canReview: boolean;
  hasInvoice: boolean;
  unitCount: number;
}

const ORDER_INCLUDE = {
  items: {
    orderBy: { id: 'asc' },
    include: {
      product: { select: { slug: true } },
    },
  },
  events: {
    where: { customerVisible: true },
    orderBy: { createdAt: 'desc' },
  },
  shipments: {
    orderBy: { createdAt: 'desc' },
    include: { events: { orderBy: { occurredAt: 'desc' } } },
  },
  invoices: { select: { id: true } },
} as const;

// ── Single order ────────────────────────────────────────────────────────────

/**
 * Fetch one order for its owner.
 *
 * Returns null rather than throwing when it isn't theirs, so the caller renders
 * a 404. A 403 would confirm that the order number exists, which is enough to
 * enumerate order volume.
 */
export async function getOrderForUser(
  orderNumber: string,
  userId: string,
): Promise<OrderView | null> {
  const order = await db.order.findFirst({
    where: { orderNumber, userId },
    include: ORDER_INCLUDE,
  });
  return order ? toOrderView(order) : null;
}

/** Admin fetch — by id or order number, no ownership filter. */
export async function getOrder(idOrNumber: string): Promise<OrderView> {
  const order = await db.order.findFirst({
    where: { OR: [{ id: idOrNumber }, { orderNumber: idOrNumber }] },
    include: ORDER_INCLUDE,
  });
  if (!order) throw new ApiFailure('not_found', 'Order not found.', 404);
  return toOrderView(order);
}

/**
 * Public order tracking — order number plus the phone or email on the order.
 *
 * Guests place orders too, and asking them to create an account to see where
 * their parcel is loses more goodwill than it protects. The second factor is
 * what keeps this from being an enumeration endpoint; it's compared
 * case-insensitively on email and on the last 10 digits of phone, because
 * customers type `+91 98765 43210` and we store `9876543210`.
 */
export async function trackOrder(input: {
  orderNumber: string;
  contact: string;
}): Promise<OrderView | null> {
  const order = await db.order.findUnique({
    where: { orderNumber: input.orderNumber.trim().toUpperCase() },
    include: {
      ...ORDER_INCLUDE,
      user: { select: { email: true, phone: true } },
    },
  });
  if (!order) return null;

  const probe = input.contact.trim().toLowerCase();
  const digits = probe.replace(/\D/g, '');
  const address = readJson<AddressSnapshot | null>(order.shippingAddressJson, null);

  const emailMatches = order.user?.email?.toLowerCase() === probe;
  const phoneMatches =
    digits.length >= 10 &&
    [order.user?.phone, address?.phone].some(
      (p) => p && p.replace(/\D/g, '').endsWith(digits.slice(-10)),
    );

  if (!emailMatches && !phoneMatches) return null;
  return toOrderView(order);
}

// ── Lists ───────────────────────────────────────────────────────────────────

export interface OrderListRow {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  grandTotal: Paise;
  amountDue: Paise;
  placedAt: Date;
  unitCount: number;
  /** First two item thumbnails, for the list's stacked preview. */
  thumbnails: string[];
  itemSummary: string;
  customerName: string | null;
  customerEmail: string | null;
  paymentMethod: string | null;
  canCancel: boolean;
  canReturn: boolean;
  canPay: boolean;
}

export async function listOrdersForUser(
  userId: string,
  page: Page,
  filter?: { status?: string | null },
): Promise<Paginated<OrderListRow>> {
  const where = {
    userId,
    ...(filter?.status && filter.status !== 'all'
      ? filter.status === 'active'
        ? { status: { in: ['pending', 'confirmed', 'packed', 'shipped'] } }
        : { status: filter.status }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      skip: page.skip,
      take: page.take,
      include: {
        items: { select: { name: true, qty: true, imageUrl: true } },
      },
    }),
    db.order.count({ where }),
  ]);

  return paginated(rows.map((r) => toListRow(r)), total, page);
}

export interface AdminOrderFilter {
  q?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  fulfillmentStatus?: string | null;
  paymentMethod?: string | null;
  from?: Date | null;
  to?: Date | null;
  /** Orders with money still owed — the collections view. */
  unpaidOnly?: boolean;
}

export async function listOrdersForAdmin(
  filter: AdminOrderFilter,
  page: Page,
): Promise<Paginated<OrderListRow>> {
  const where = buildAdminWhere(filter);

  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      skip: page.skip,
      take: page.take,
      include: {
        items: { select: { name: true, qty: true, imageUrl: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    db.order.count({ where }),
  ]);

  return paginated(rows.map((r) => toListRow(r)), total, page);
}

function buildAdminWhere(filter: AdminOrderFilter) {
  const and: Record<string, unknown>[] = [];

  if (filter.q?.trim()) {
    const q = filter.q.trim();
    // SQLite's LIKE is case-insensitive for ASCII by default, which covers
    // order numbers and emails. `mode: 'insensitive'` is a Postgres-only option
    // and would throw here, so it is deliberately absent.
    and.push({
      OR: [
        { orderNumber: { contains: q } },
        { user: { email: { contains: q } } },
        { user: { phone: { contains: q } } },
        { user: { name: { contains: q } } },
        { items: { some: { sku: { contains: q } } } },
      ],
    });
  }

  if (filter.status && filter.status !== 'all') and.push({ status: filter.status });
  if (filter.paymentStatus) and.push({ paymentStatus: filter.paymentStatus });
  if (filter.fulfillmentStatus) and.push({ fulfillmentStatus: filter.fulfillmentStatus });
  if (filter.paymentMethod) and.push({ paymentMethod: filter.paymentMethod });
  if (filter.unpaidOnly) and.push({ amountDue: { gt: 0 }, status: { not: 'cancelled' } });
  if (filter.from) and.push({ placedAt: { gte: filter.from } });
  if (filter.to) and.push({ placedAt: { lte: filter.to } });

  return and.length ? { AND: and } : {};
}

// ── Derived rules ───────────────────────────────────────────────────────────

/**
 * Whether the customer may cancel this order themselves.
 *
 * The cut-off is `packed`: once a parcel is sealed and manifested, a
 * self-service cancellation means someone in the warehouse has to find it and
 * unpack it. After that point the customer is directed to refuse delivery or
 * raise a return, both of which the operations team can actually action.
 */
export function canCancelOrder(order: {
  status: string;
  paymentStatus: string;
}): boolean {
  return order.status === 'pending' || order.status === 'confirmed';
}

/** Return window: delivered, inside the window, and something left to return. */
export function canReturnOrder(order: {
  status: string;
  returnWindowEndsAt: Date | null;
  items?: readonly { qty: number; returnedQty: number; cancelledQty: number }[];
}): boolean {
  if (order.status !== 'delivered') return false;
  if (!order.returnWindowEndsAt || order.returnWindowEndsAt.getTime() < Date.now()) return false;
  if (!order.items) return true;
  return order.items.some((i) => i.qty - i.returnedQty - i.cancelledQty > 0);
}

/** An unpaid, uncancelled order the customer can still complete payment on. */
export function canPayOrder(order: {
  status: string;
  paymentStatus: string;
  amountDue: number;
  paymentMethod: string | null;
}): boolean {
  if (order.status === 'cancelled' || order.status === 'returned') return false;
  if (order.paymentMethod === 'cod') return false;
  return order.amountDue > 0 && order.paymentStatus !== 'paid';
}

/**
 * Lines eligible for return, with the maximum returnable quantity.
 *
 * `qty − returnedQty − cancelledQty` is the whole rule, but computing it in the
 * return form is how a customer ends up able to return three of two shirts.
 */
export async function returnableLines(orderId: string): Promise<
  {
    orderItemId: string;
    name: string;
    sku: string;
    size: string | null;
    color: string | null;
    imageUrl: string | null;
    unitPrice: Paise;
    maxQty: number;
    /** Refundable value of one unit, net of its share of the discount. */
    refundPerUnit: Paise;
  }[]
> {
  const items = await db.orderItem.findMany({
    where: { orderId },
    orderBy: { id: 'asc' },
  });

  return items
    .map((i) => {
      const maxQty = i.qty - i.returnedQty - i.cancelledQty;
      // The refundable amount is what the customer actually paid for the unit —
      // list price minus its allocated discount, plus its tax. Refunding
      // `unitPrice` would hand back money that was never collected.
      const perUnit = i.qty > 0 ? Math.round((i.lineTotal + i.taxAmount) / i.qty) : 0;
      return {
        orderItemId: i.id,
        name: i.name,
        sku: i.sku,
        size: i.size,
        color: i.color,
        imageUrl: i.imageUrl,
        unitPrice: i.unitPrice,
        maxQty,
        refundPerUnit: perUnit,
      };
    })
    .filter((l) => l.maxQty > 0);
}

// ── Mappers ─────────────────────────────────────────────────────────────────

type OrderWithIncludes = Awaited<
  ReturnType<typeof db.order.findFirstOrThrow<{ include: typeof ORDER_INCLUDE }>>
>;

function toOrderView(order: OrderWithIncludes): OrderView {
  const shippingAddress = readJson<AddressSnapshot | null>(order.shippingAddressJson, null);
  const billingAddress = readJson<AddressSnapshot | null>(order.billingAddressJson, null);

  const items: OrderLineView[] = order.items.map((i) => ({
    id: i.id,
    productId: i.productId,
    variantId: i.variantId,
    name: i.name,
    sku: i.sku,
    size: i.size,
    color: i.color,
    imageUrl: i.imageUrl,
    unitPrice: i.unitPrice,
    qty: i.qty,
    discount: i.discount,
    taxAmount: i.taxAmount,
    lineTotal: i.lineTotal,
    fulfillmentStatus: i.fulfillmentStatus,
    returnedQty: i.returnedQty,
    cancelledQty: i.cancelledQty,
    slug: i.product?.slug ?? null,
    returnable: i.qty - i.returnedQty - i.cancelledQty > 0,
  }));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    paymentMethod: order.paymentMethod,

    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    shippingTotal: order.shippingTotal,
    codFee: order.codFee,
    taxTotal: order.taxTotal,
    walletApplied: order.walletApplied,
    grandTotal: order.grandTotal,
    amountPaid: order.amountPaid,
    amountDue: order.amountDue,

    couponCode: order.couponCode,
    giftWrap: order.giftWrap,
    customerNote: order.customerNote,

    shippingAddress,
    billingAddress,
    shippingAddressLine: shippingAddress ? formatAddress(shippingAddress) : '',

    placedAt: order.placedAt,
    confirmedAt: order.confirmedAt,
    deliveredAt: order.deliveredAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    returnWindowEndsAt: order.returnWindowEndsAt,

    items,
    timeline: order.events.map((e) => ({
      id: e.id,
      status: e.status,
      title: e.title,
      description: e.description,
      location: e.location,
      at: e.createdAt,
      actorType: e.actorType,
    })),
    shipments: order.shipments.map((s) => ({
      id: s.id,
      courier: s.courier,
      courierName: s.courierName,
      awb: s.awb,
      trackingUrl: s.trackingUrl,
      status: s.status,
      shippedAt: s.shippedAt,
      deliveredAt: s.deliveredAt,
      events: s.events.map((e) => ({
        status: e.status,
        message: e.message,
        location: e.location,
        at: e.occurredAt,
      })),
    })),

    canCancel: canCancelOrder(order),
    canReturn: canReturnOrder(order),
    canPay: canPayOrder(order),
    // A review needs a delivered order; the per-product "already reviewed" check
    // happens in reviews.ts, which knows about the review rows.
    canReview: order.status === 'delivered',
    hasInvoice: order.invoices.length > 0,
    unitCount: items.reduce((n, i) => n + i.qty, 0),
  };
}

function toListRow(order: {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentMethod: string | null;
  grandTotal: number;
  amountDue: number;
  placedAt: Date;
  returnWindowEndsAt: Date | null;
  items: { name: string; qty: number; imageUrl: string | null }[];
  user?: { name: string | null; email: string | null } | null;
}): OrderListRow {
  const unitCount = order.items.reduce((n, i) => n + i.qty, 0);
  const first = order.items[0];
  const extra = order.items.length - 1;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    grandTotal: order.grandTotal,
    amountDue: order.amountDue,
    placedAt: order.placedAt,
    unitCount,
    thumbnails: order.items
      .map((i) => i.imageUrl)
      .filter((u): u is string => Boolean(u))
      .slice(0, 3),
    itemSummary: first
      ? extra > 0
        ? `${first.name} + ${extra} more`
        : first.name
      : 'No items',
    customerName: order.user?.name ?? null,
    customerEmail: order.user?.email ?? null,
    paymentMethod: order.paymentMethod,
    canCancel: canCancelOrder(order),
    canReturn: canReturnOrder({
      status: order.status,
      returnWindowEndsAt: order.returnWindowEndsAt,
    }),
    canPay: canPayOrder(order),
  };
}

// ── Stats ───────────────────────────────────────────────────────────────────

export interface OrderCounts {
  all: number;
  pending: number;
  confirmed: number;
  packed: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  returned: number;
  unpaid: number;
}

/**
 * Status tab counts for the admin list.
 *
 * One `groupBy` rather than eight `count` calls — the admin header renders on
 * every page load and eight round-trips is the difference between a snappy table
 * and a visible delay.
 */
export async function orderCounts(filter: AdminOrderFilter = {}): Promise<OrderCounts> {
  const where = buildAdminWhere({ ...filter, status: null });

  const [groups, unpaid] = await Promise.all([
    db.order.groupBy({ by: ['status'], where, _count: { _all: true } }),
    db.order.count({
      where: { ...where, amountDue: { gt: 0 }, status: { not: 'cancelled' } },
    }),
  ]);

  const counts: OrderCounts = {
    all: 0,
    pending: 0,
    confirmed: 0,
    packed: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    returned: 0,
    unpaid,
  };

  for (const g of groups) {
    const n = g._count._all;
    counts.all += n;
    if (g.status in counts) {
      counts[g.status as keyof OrderCounts] = n;
    }
  }

  return counts;
}
