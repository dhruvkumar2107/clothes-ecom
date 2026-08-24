import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSession, requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';
import { readJson } from '@/lib/json';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireCustomer();

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const includeEvents = searchParams.get('includeEvents') === 'true';
    const includeShipments = searchParams.get('includeShipments') === 'true';
    const includeInvoices = searchParams.get('includeInvoices') === 'true';

    const order = await db.order.findFirst({
      where: { id, userId: session.userId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        currency: true,
        fxRate: true,
        subtotal: true,
        discountTotal: true,
        shippingTotal: true,
        codFee: true,
        taxTotal: true,
        walletApplied: true,
        grandTotal: true,
        amountPaid: true,
        amountDue: true,
        paymentMethod: true,
        couponCode: true,
        referralCodeUsed: true,
        shippingAddressJson: true,
        billingAddressJson: true,
        customerNote: true,
        adminNote: true,
        giftWrap: true,
        placedAt: true,
        confirmedAt: true,
        cancelledAt: true,
        cancelReason: true,
        cancelledBy: true,
        deliveredAt: true,
        returnWindowEndsAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            variantId: true,
            name: true,
            sku: true,
            size: true,
            color: true,
            imageUrl: true,
            hsnCode: true,
            unitPrice: true,
            qty: true,
            discount: true,
            taxRate: true,
            taxAmount: true,
            lineTotal: true,
            fulfillmentStatus: true,
            returnedQty: true,
            cancelledQty: true,
            product: { select: { slug: true, name: true } },
          },
        },
        events: includeEvents
          ? {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                status: true,
                title: true,
                description: true,
                location: true,
                actorType: true,
                createdAt: true,
              },
            }
          : false,
        shipments: includeShipments
          ? {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                courier: true,
                courierName: true,
                awb: true,
                trackingUrl: true,
                labelUrl: true,
                manifestUrl: true,
                status: true,
                weightGrams: true,
                charges: true,
                pickupScheduledAt: true,
                shippedAt: true,
                deliveredAt: true,
                createdAt: true,
                events: {
                  orderBy: { occurredAt: 'asc' },
                  select: { id: true, status: true, message: true, location: true, occurredAt: true },
                },
              },
            }
          : false,
        invoices: includeInvoices
          ? {
              orderBy: { issuedAt: 'desc' },
              select: {
                id: true,
                invoiceNumber: true,
                kind: true,
                total: true,
                issuedAt: true,
              },
            }
          : false,
        refunds: {
          select: {
            id: true,
            amount: true,
            mode: true,
            status: true,
            createdAt: true,
            completedAt: true,
          },
        },
        returns: {
          select: {
            id: true,
            returnNumber: true,
            kind: true,
            status: true,
            refundAmount: true,
            requestedAt: true,
            completedAt: true,
            items: {
              select: { qty: true, orderItemId: true },
            },
          },
        },
      },
    });

    if (!order) {
      return apiError('NOT_FOUND', 'Order not found', 404);
    }

    const { readJson } = await import('@/lib/json');
    const shippingAddress = readJson(order.shippingAddressJson, null);
    const billingAddress = readJson(order.billingAddressJson, null);

    return apiOk({
      data: {
        ...order,
        shippingAddress,
        billingAddress,
      },
    });
  } catch (error) {
    console.error('Order detail error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load order', 500);
  }
}