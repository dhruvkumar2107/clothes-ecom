import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return apiError('UNAUTHORIZED', 'Invalid cron secret', 401);
    }

    const variants = await db.productVariant.findMany({
      where: { active: true },
      select: { id: true, stock: true, reserved: true },
    });

    let corrected = 0;
    let discrepancies = 0;

    for (const variant of variants) {
      const ledgerSum = await db.inventoryLedger.aggregate({
        where: { variantId: variant.id },
        _sum: { delta: true },
      });

      const calculatedStock = (ledgerSum._sum.delta || 0);
      const currentStock = variant.stock;

      if (calculatedStock !== currentStock) {
        discrepancies++;
        const delta = calculatedStock - currentStock;
        await db.inventoryLedger.create({
          data: {
            variantId: variant.id,
            delta,
            stockAfter: calculatedStock,
            reason: 'correction',
            note: `Auto-correction: ledger sum (${calculatedStock}) != variant stock (${currentStock})`,
            actorType: 'system',
          },
        });
        await db.productVariant.update({
          where: { id: variant.id },
          data: { stock: calculatedStock },
        });
        corrected++;
      }

      const reservedFromOrders = await db.orderItem.aggregate({
        where: {
          variantId: variant.id,
          order: { status: { in: ['pending', 'confirmed', 'packed'] }, paymentStatus: { not: 'cancelled' } },
        },
        _sum: { qty: true },
      });

      const reservedFromCarts = await db.cartItem.aggregate({
        where: { variantId: variant.id, cart: { status: 'active' } },
        _sum: { qty: true },
      });

      const expectedReserved = (reservedFromOrders._sum.qty || 0) + (reservedFromCarts._sum.qty || 0);
      if (expectedReserved !== variant.reserved) {
        await db.productVariant.update({
          where: { id: variant.id },
          data: { reserved: expectedReserved },
        });
      }
    }

    return apiOk({ data: { checked: variants.length, discrepancies, corrected } });
  } catch (error: any) {
    console.error('Inventory reconciliation cron error:', error);
    return apiError('INTERNAL_ERROR', 'Cron job failed', 500);
  }
}