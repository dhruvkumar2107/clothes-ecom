import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';
import { getPaymentGateway, getPayoutGateway, getBankVerifier, getShippingProvider } from '@/lib/adapters/registry';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    const provider = request.nextUrl.searchParams.get('provider') || 'unknown';

    // Store webhook event for idempotency
    const webhookEvent = await db.webhookEvent.create({
      data: {
        provider,
        eventId: headers['x-razorpay-event-id'] || headers['x-cashfree-event-id'] || crypto.randomUUID(),
        eventType: headers['x-razorpay-event-type'] || 'unknown',
        payloadJson: body,
        signature: headers['x-razorpay-signature'] || headers['x-cashfree-signature'] || '',
      },
    });

    // Route to appropriate handler based on provider
    switch (provider) {
      case 'razorpay':
      case 'razorpayx':
        await handleRazorpayWebhook(body, headers, webhookEvent.id);
        break;
      case 'cashfree':
        await handleCashfreeWebhook(body, headers, webhookEvent.id);
        break;
      case 'shiprocket':
      case 'delhivery':
        await handleShippingWebhook(body, headers, webhookEvent.id);
        break;
      case 'decentro':
        await handleVerificationWebhook(body, headers, webhookEvent.id);
        break;
    }

    await db.webhookEvent.update({ where: { id: webhookEvent.id }, data: { processedAt: new Date(), signatureValid: true } });

    return apiOk({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return apiError('INTERNAL_ERROR', 'Webhook processing failed', 500);
  }
}

async function handleRazorpayWebhook(body: string, headers: Record<string, string>, eventId: string) {
  const paymentGateway = getPaymentGateway();
  if (!paymentGateway.verifyWebhookSignature(body, headers['x-razorpay-signature'] || '')) {
    throw new Error('Invalid signature');
  }

  const webhook = paymentGateway.parseWebhook(body);
  if (webhook.subject.kind === 'payment' && webhook.eventType === 'payment.captured') {
    const { providerPaymentId, providerOrderId, amount } = webhook.subject.payment;
    const order = await db.order.findFirst({ where: { intents: { some: { providerOrderId } } } });
    if (order && order.paymentStatus !== 'paid') {
      const { confirmOrderPaid } = await import('@/lib/orders/create');
      await confirmOrderPaid({ orderId: order.id, amount, method: order.paymentMethod as any, reference: providerPaymentId });
    }
  }
}

async function handleCashfreeWebhook(body: string, headers: Record<string, string>, eventId: string) {
  // Cashfree webhook handling
}

async function handleShippingWebhook(body: string, headers: Record<string, string>, eventId: string) {
  // Shiprocket/Delhivery webhook handling
}

async function handleVerificationWebhook(body: string, headers: Record<string, string>, eventId: string) {
  // Decentro verification webhook handling
}