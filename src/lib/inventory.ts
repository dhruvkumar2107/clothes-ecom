import { db, tx, type DbClient } from './db';
import type { InventoryReason } from './enums';

/**
 * Inventory.
 *
 * One rule: **stock is never assigned to, only adjusted through this module.**
 * Every movement writes an InventoryLedger row carrying a signed delta, the
 * resulting stock level, a reason, and a back-reference to whatever caused it.
 *
 * That costs a write per movement, and buys the one question a store actually
 * needs answered at 2am: *why is this SKU showing 3 when we shipped 5?* A bare
 * `stock` column can't answer it. The ledger replays.
 *
 * ── Reserved vs stock ──────────────────────────────────────────────────────
 *
 * `stock` is physical units on the shelf. `reserved` is units promised to
 * in-flight checkouts that have not yet shipped. Sellable = stock − reserved.
 *
 * Reserving at checkout rather than decrementing stock matters because a
 * customer who abandons a payment must not permanently consume inventory, and a
 * warehouse count must still reconcile against `stock` while orders are open.
 * The transitions are:
 *
 *   checkout starts   → reserve()          reserved +n
 *   payment succeeds  → commitReservation() reserved −n, stock −n  (reason: sale)
 *   payment fails     → releaseReservation() reserved −n
 *   order cancelled   → restock()           stock +n               (reason: cancel)
 *   return received   → restock()           stock +n               (reason: return)
 */

export class InventoryError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'InventoryError';
    this.code = code;
    this.status = status;
  }
}

export interface MovementRef {
  reason: InventoryReason;
  refType?: string | null;
  refId?: string | null;
  note?: string | null;
  actorType?: 'staff' | 'customer' | 'system';
  actorId?: string | null;
}

// ── Availability ────────────────────────────────────────────────────────────

export interface Availability {
  variantId: string;
  sku: string;
  stock: number;
  reserved: number;
  /** stock − reserved, floored at zero. What a customer may actually buy. */
  sellable: number;
  inStock: boolean;
  lowStock: boolean;
  active: boolean;
}

export function sellableOf(variant: { stock: number; reserved: number }): number {
  return Math.max(0, variant.stock - variant.reserved);
}

export async function availability(
  variantIds: readonly string[],
  client: DbClient = db,
): Promise<Map<string, Availability>> {
  if (variantIds.length === 0) return new Map();

  const variants = await client.productVariant.findMany({
    where: { id: { in: [...variantIds] } },
    select: {
      id: true,
      sku: true,
      stock: true,
      reserved: true,
      lowStockThreshold: true,
      active: true,
    },
  });

  return new Map(
    variants.map((v) => {
      const sellable = sellableOf(v);
      return [
        v.id,
        {
          variantId: v.id,
          sku: v.sku,
          stock: v.stock,
          reserved: v.reserved,
          sellable,
          inStock: sellable > 0 && v.active,
          lowStock: sellable > 0 && sellable <= v.lowStockThreshold,
          active: v.active,
        },
      ];
    }),
  );
}

// ── Ledger ──────────────────────────────────────────────────────────────────

/**
 * Adjust stock by a signed delta and record it.
 *
 * Guards against going negative, because a negative stock level is not a
 * recoverable state — it means something already oversold, and continuing
 * silently compounds it.
 */
export async function adjust(
  input: { variantId: string; delta: number } & MovementRef,
  client: DbClient = db,
): Promise<{ stockAfter: number }> {
  const variant = await client.productVariant.findUnique({
    where: { id: input.variantId },
    select: { id: true, stock: true, sku: true },
  });
  if (!variant) throw new InventoryError('variant_not_found', 'Variant not found.', 404);

  const stockAfter = variant.stock + input.delta;
  if (stockAfter < 0) {
    throw new InventoryError(
      'insufficient_stock',
      `${variant.sku} has ${variant.stock} in stock; cannot remove ${Math.abs(input.delta)}.`,
    );
  }

  await client.productVariant.update({
    where: { id: variant.id },
    data: { stock: stockAfter },
  });

  await client.inventoryLedger.create({
    data: {
      variantId: variant.id,
      delta: input.delta,
      stockAfter,
      reason: input.reason,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      note: input.note ?? null,
      actorType: input.actorType ?? 'system',
      actorId: input.actorId ?? null,
    },
  });

  return { stockAfter };
}

/** Set stock to an absolute value — a warehouse count, not a movement. */
export async function setStock(
  input: { variantId: string; stock: number } & Omit<MovementRef, 'reason'>,
  client: DbClient = db,
): Promise<{ stockAfter: number; delta: number }> {
  if (input.stock < 0) {
    throw new InventoryError('invalid_stock', 'Stock cannot be negative.');
  }

  const variant = await client.productVariant.findUnique({
    where: { id: input.variantId },
    select: { stock: true },
  });
  if (!variant) throw new InventoryError('variant_not_found', 'Variant not found.', 404);

  const delta = input.stock - variant.stock;
  if (delta === 0) return { stockAfter: input.stock, delta: 0 };

  const result = await adjust({ ...input, delta, reason: 'correction' }, client);
  return { stockAfter: result.stockAfter, delta };
}

// ── Reservations ────────────────────────────────────────────────────────────

export interface ReserveLine {
  variantId: string;
  qty: number;
}

export interface ReserveFailure {
  variantId: string;
  sku: string;
  requested: number;
  available: number;
  name: string;
}

/**
 * Reserve stock for a checkout.
 *
 * All-or-nothing: if any line can't be satisfied, nothing is reserved and the
 * shortfalls are returned so the cart can show "only 2 left" against the exact
 * offending items. Partially reserving would leave the customer with a cart that
 * silently changed under them.
 *
 * Runs inside a transaction — SQLite serialises writers, so two simultaneous
 * checkouts for the last unit cannot both succeed.
 */
export async function reserve(
  lines: readonly ReserveLine[],
  ref: Omit<MovementRef, 'reason'>,
): Promise<{ ok: true } | { ok: false; failures: ReserveFailure[] }> {
  if (lines.length === 0) return { ok: true };

  return tx(async (client) => {
    const variants = await client.productVariant.findMany({
      where: { id: { in: lines.map((l) => l.variantId) } },
      select: {
        id: true,
        sku: true,
        stock: true,
        reserved: true,
        active: true,
        size: true,
        color: true,
        product: { select: { name: true, status: true } },
      },
    });

    const byId = new Map(variants.map((v) => [v.id, v]));
    const failures: ReserveFailure[] = [];

    for (const line of lines) {
      const variant = byId.get(line.variantId);
      if (!variant) {
        failures.push({
          variantId: line.variantId,
          sku: '—',
          requested: line.qty,
          available: 0,
          name: 'Unavailable item',
        });
        continue;
      }

      const label = `${variant.product.name} · ${variant.size} · ${variant.color}`;
      const sellable = sellableOf(variant);
      const purchasable = variant.active && variant.product.status === 'active';

      if (!purchasable || sellable < line.qty) {
        failures.push({
          variantId: variant.id,
          sku: variant.sku,
          requested: line.qty,
          available: purchasable ? sellable : 0,
          name: label,
        });
      }
    }

    if (failures.length > 0) return { ok: false as const, failures };

    for (const line of lines) {
      await client.productVariant.update({
        where: { id: line.variantId },
        data: { reserved: { increment: line.qty } },
      });
      await client.inventoryLedger.create({
        data: {
          variantId: line.variantId,
          // Reservations don't move physical stock, so delta is 0 and
          // stockAfter is unchanged — the row exists to timestamp the hold.
          delta: 0,
          stockAfter: byId.get(line.variantId)!.stock,
          reason: 'reservation',
          refType: ref.refType ?? null,
          refId: ref.refId ?? null,
          note: ref.note ?? `Reserved ${line.qty}`,
          actorType: ref.actorType ?? 'system',
          actorId: ref.actorId ?? null,
        },
      });
    }

    return { ok: true as const };
  });
}

/** Release a reservation without shipping — payment failed or cart expired. */
export async function releaseReservation(
  lines: readonly ReserveLine[],
  ref: Omit<MovementRef, 'reason'>,
  client?: DbClient,
): Promise<void> {
  const run = async (c: DbClient) => {
    for (const line of lines) {
      const variant = await c.productVariant.findUnique({
        where: { id: line.variantId },
        select: { stock: true, reserved: true },
      });
      if (!variant) continue;

      // Never drive `reserved` negative: a double-release (a webhook retry plus a
      // manual cancel) must be idempotent rather than corrupting the count.
      const release = Math.min(line.qty, variant.reserved);
      if (release === 0) continue;

      await c.productVariant.update({
        where: { id: line.variantId },
        data: { reserved: { decrement: release } },
      });
      await c.inventoryLedger.create({
        data: {
          variantId: line.variantId,
          delta: 0,
          stockAfter: variant.stock,
          reason: 'release',
          refType: ref.refType ?? null,
          refId: ref.refId ?? null,
          note: ref.note ?? `Released ${release}`,
          actorType: ref.actorType ?? 'system',
          actorId: ref.actorId ?? null,
        },
      });
    }
  };

  if (client) return run(client);
  return tx(run);
}

/**
 * Convert a reservation into a real stock decrement — the order is confirmed and
 * the goods are committed.
 */
export async function commitReservation(
  lines: readonly ReserveLine[],
  ref: Omit<MovementRef, 'reason'>,
  client?: DbClient,
): Promise<void> {
  const run = async (c: DbClient) => {
    for (const line of lines) {
      const variant = await c.productVariant.findUnique({
        where: { id: line.variantId },
        select: { id: true, sku: true, stock: true, reserved: true },
      });
      if (!variant) continue;

      const release = Math.min(line.qty, variant.reserved);
      // Physical stock may legitimately be short of the reservation if a manual
      // correction happened in between; floor at zero rather than go negative.
      const remove = Math.min(line.qty, variant.stock);

      await c.productVariant.update({
        where: { id: variant.id },
        data: {
          reserved: { decrement: release },
          stock: { decrement: remove },
        },
      });

      await c.inventoryLedger.create({
        data: {
          variantId: variant.id,
          delta: -remove,
          stockAfter: variant.stock - remove,
          reason: 'sale',
          refType: ref.refType ?? null,
          refId: ref.refId ?? null,
          note: ref.note ?? null,
          actorType: ref.actorType ?? 'system',
          actorId: ref.actorId ?? null,
        },
      });

      // Sold count drives the "bestseller" sort and the PDP social proof.
      await c.productVariant
        .findUnique({ where: { id: variant.id }, select: { productId: true } })
        .then((v) =>
          v
            ? c.product.update({
                where: { id: v.productId },
                data: { soldCount: { increment: line.qty } },
              })
            : null,
        );
    }
  };

  if (client) return run(client);
  return tx(run);
}

/** Put units back on the shelf — a cancellation or an accepted return. */
export async function restock(
  lines: readonly ReserveLine[],
  ref: MovementRef,
  client?: DbClient,
): Promise<void> {
  const run = async (c: DbClient) => {
    for (const line of lines) {
      if (line.qty <= 0) continue;
      await adjust({ variantId: line.variantId, delta: line.qty, ...ref }, c);
    }
  };

  if (client) return run(client);
  return tx(run);
}

// ── Reporting ───────────────────────────────────────────────────────────────

export interface LowStockRow {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
  reserved: number;
  sellable: number;
  threshold: number;
}

/**
 * Variants at or below their low-stock threshold.
 *
 * Filtered in application code rather than SQL because the comparison is between
 * two columns (`stock - reserved <= lowStockThreshold`), which Prisma can't
 * express portably. The candidate set is bounded by a generous stock ceiling so
 * this stays a small scan rather than a full table read.
 */
export async function lowStock(limit = 100): Promise<LowStockRow[]> {
  const candidates = await db.productVariant.findMany({
    where: { active: true, stock: { lte: 25 }, product: { status: 'active' } },
    select: {
      id: true,
      sku: true,
      size: true,
      color: true,
      stock: true,
      reserved: true,
      lowStockThreshold: true,
      productId: true,
      product: { select: { name: true } },
    },
    orderBy: { stock: 'asc' },
    take: limit * 3,
  });

  return candidates
    .map((v) => ({
      variantId: v.id,
      productId: v.productId,
      productName: v.product.name,
      sku: v.sku,
      size: v.size,
      color: v.color,
      stock: v.stock,
      reserved: v.reserved,
      sellable: sellableOf(v),
      threshold: v.lowStockThreshold,
    }))
    .filter((row) => row.sellable <= row.threshold)
    .slice(0, limit);
}

export async function ledgerFor(
  variantId: string,
  limit = 50,
): Promise<
  {
    id: string;
    delta: number;
    stockAfter: number;
    reason: string;
    note: string | null;
    refType: string | null;
    refId: string | null;
    createdAt: Date;
  }[]
> {
  return db.inventoryLedger.findMany({
    where: { variantId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      delta: true,
      stockAfter: true,
      reason: true,
      note: true,
      refType: true,
      refId: true,
      createdAt: true,
    },
  });
}

/**
 * Recompute `reserved` from open orders.
 *
 * A crashed process between "reserve" and "commit" can leave a phantom hold that
 * makes stock look unsellable forever. Rather than trusting the counter, this
 * derives the truth from orders still awaiting fulfilment and reports the drift.
 * Exposed in the admin as a maintenance action; it is safe to run any time.
 */
export async function reconcileReservations(): Promise<{
  checked: number;
  corrected: { variantId: string; sku: string; was: number; now: number }[];
}> {
  const openItems = await db.orderItem.findMany({
    where: {
      order: { status: { in: ['pending'] }, paymentStatus: { in: ['unpaid', 'authorized'] } },
    },
    select: { variantId: true, qty: true, cancelledQty: true },
  });

  const expected = new Map<string, number>();
  for (const item of openItems) {
    const live = Math.max(0, item.qty - item.cancelledQty);
    expected.set(item.variantId, (expected.get(item.variantId) ?? 0) + live);
  }

  const variants = await db.productVariant.findMany({
    where: { OR: [{ reserved: { gt: 0 } }, { id: { in: [...expected.keys()] } }] },
    select: { id: true, sku: true, reserved: true },
  });

  const corrected: { variantId: string; sku: string; was: number; now: number }[] = [];

  for (const variant of variants) {
    const should = expected.get(variant.id) ?? 0;
    if (should === variant.reserved) continue;

    await db.productVariant.update({
      where: { id: variant.id },
      data: { reserved: should },
    });
    corrected.push({
      variantId: variant.id,
      sku: variant.sku,
      was: variant.reserved,
      now: should,
    });
  }

  return { checked: variants.length, corrected };
}
