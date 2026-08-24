import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';
import { getShippingProvider } from '@/lib/adapters/registry';

const ShippingListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  orderId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(['orders.read']);
    const params = parseQuery(request, ShippingListSchema);

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.orderId) where.orderId = params.orderId;

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const [shipments, total] = await Promise.all([
      db.shipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order: { select: { id: true, orderNumber: true, user: { select: { name: true, email: true } } } },
          events: { orderBy: { occurredAt: 'asc' } },
        },
      }),
      db.shipment.count({ where }),
    ]);

    return apiOk({ data: shipments, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin shipments list error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load shipments', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(['orders.write']);
    const body = await request.json();
    const { action, shipmentId, ...data } = body;

    if (action === 'create') {
      const { orderId, courier, awb, trackingUrl } = data;
      const order = await db.order.findUnique({ 
      where: { id: orderId },
      include: { items: { include: { variant: true } }, user: true }
    });
      if (!order) return apiError('NOT_FOUND', 'Order not found', 404);

      const shippingProvider = getShippingProvider();
      let shipment;
      if (courier !== 'manual') {
        const shippingAddress = JSON.parse(order.shippingAddressJson);
        shipment = await shippingProvider.createShipment({
          orderNumber: order.orderNumber,
          items: order.items.map(item => ({
            name: item.name,
            sku: item.sku,
            qty: item.qty,
            unitPrice: item.unitPrice,
            hsn: item.hsnCode,
            weightGrams: item.variant?.weightGrams || 350,
          })),
          weightGrams: order.items.reduce((sum, item) => sum + (item.variant?.weightGrams || 350) * item.qty, 0),
          consignee: {
            name: shippingAddress.name,
            phone: shippingAddress.phone,
            line1: shippingAddress.line1,
            line2: shippingAddress.line2,
            city: shippingAddress.city,
            state: shippingAddress.state,
            pincode: shippingAddress.pincode,
            country: shippingAddress.country,
            email: order.user?.email,
          },
          codAmount: order.paymentMethod === 'cod' ? order.amountDue : 0,
          declaredValue: order.grandTotal,
        });
      } else {
        shipment = await db.shipment.create({ data: { orderId, courier: 'manual', awb, trackingUrl, status: 'created' } });
      }

      await db.order.update({ where: { id: orderId }, data: { status: 'shipped', fulfillmentStatus: 'fulfilled' } });
      await db.orderEvent.create({ data: { orderId, status: 'shipped', title: 'Order Shipped', description: `Created shipment via ${courier}` } });

      return apiOk({ data: shipment }, { status: 201 });
    }

    if (action === 'track' && shipmentId) {
      const shippingProvider = getShippingProvider();
      const tracking = await shippingProvider.track(data.awb || '');
      return apiOk({ data: tracking });
    }

    return apiError('INVALID_ACTION', 'Unknown action', 400);
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin shipping action error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to process shipping action', 500);
  }
}