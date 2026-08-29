import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { confirmOrderPaid } from '@/lib/orders/create';
import { cancelOrder } from '@/lib/orders/transitions';
import { verifyWebhookSignature } from '@/lib/api';
import { getPaymentAdapter } from '@/lib/adapters/registry';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const provider = request.nextUrl.searchParams.get('provider') || 'razorpay';
    const signature = request.headers.get('x-razorpay-signature') || 
                      request.headers.get('stripe-signature') || 
                      request.headers.get('x-signature');
    const body = await request.text();

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;

    if (!secret) {
      console.error('Webhook secret not configured — rejecting all webhooks');
      return apiError('CONFIG_ERROR', 'Webhook verification not configured', 500);
    }

    if (!signature) {
      return apiError('MISSING_SIGNATURE', 'Webhook signature is required', 400);
    }

    const valid = await verifyWebhookSignature(body, signature, secret, provider);
    if (!valid) {
      return apiError('INVALID_SIGNATURE', 'Invalid webhook signature', 400);
    }

    const eventId = request.headers.get('x-razorpay-event-id') || 
                    request.headers.get('stripe-event-id') ||
                    crypto.randomUUID();
    
    const existing = await db.webhookEvent.findUnique({
      where: { provider_eventId: { provider, eventId } },
    });
    if (existing) {
      return apiOk({ received: true, duplicate: true });
    }

    const payload = JSON.parse(body);
    const eventType = payload.event || payload.type;

    await db.webhookEvent.create({
      data: {
        provider,
        eventId,
        eventType,
        payloadJson: body,
        signature,
        signatureValid: true,
      },
    });

    await handleWebhook(provider, eventType, payload);

    await db.webhookEvent.update({
      where: { provider_eventId: { provider, eventId } },
      data: { processedAt: new Date() },
    });

    return apiOk({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return apiError('WEBHOOK_ERROR', 'Webhook processing failed', 500);
  }
}

async function handleWebhook(provider: string, eventType: string, payload: any) {
  const adapter = getPaymentAdapter();

  switch (eventType) {
    case 'payment.captured':
    case 'charge.succeeded':
    case 'payment_intent.succeeded': {
      const paymentId = payload.payment?.entity?.id || payload.data?.object?.id;
      const orderId = payload.payment?.entity?.notes?.order_id || payload.data?.object?.metadata?.order_id;
      const amount = payload.payment?.entity?.amount || payload.data?.object?.amount_received || 0;

      if (orderId && paymentId) {
        const order = await db.order.findUnique({
          where: { orderNumber: orderId },
          select: { id: true, amountDue: true },
        });
        if (order && order.amountDue > 0) {
          await confirmOrderPaid({
            orderId: order.id,
            amount: amount,
            method: 'card',
            reference: paymentId,
          });
        }
      }
      break;
    }

    case 'payment.failed':
    case 'charge.failed':
    case 'payment_intent.payment_failed': {
      const orderId = payload.payment?.entity?.notes?.order_id || payload.data?.object?.metadata?.order_id;

      if (orderId) {
        const order = await db.order.findUnique({
          where: { orderNumber: orderId },
          select: { id: true, paymentStatus: true },
        });
        if (order && order.paymentStatus === 'unpaid') {
          await db.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'failed' },
          });
        }
      }
      break;
    }

    case 'refund.created':
    case 'charge.refunded':
    case 'refund.succeeded': {
      const refundId = payload.refund?.entity?.id || payload.data?.object?.id;
      const orderId = payload.refund?.entity?.notes?.order_id || payload.data?.object?.metadata?.order_id;
      const amount = payload.refund?.entity?.amount || payload.data?.object?.amount;

      if (orderId) {
        const order = await db.order.findUnique({
          where: { orderNumber: orderId },
          select: { id: true, userId: true },
        });
        if (order) {
          const existingRefund = await db.refund.findFirst({
            where: { orderId: order.id, providerRefundId: refundId },
          });
          if (!existingRefund) {
            await db.refund.create({
              data: {
                orderId: order.id,
                userId: order.userId,
                amount: amount,
                mode: 'source',
                status: 'completed',
                provider: provider,
                providerRefundId: refundId,
                initiatedBy: 'system',
              },
            });
          }
        }
      }
      break;
    }

    case 'order.paid':
    case 'checkout.session.completed': {
      break;
    }
  }
}
