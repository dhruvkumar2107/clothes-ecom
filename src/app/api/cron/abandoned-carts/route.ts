import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';
import { getMailer, getSmsSender } from '@/lib/adapters/registry';
import { formatMoney, INR } from '@/lib/money';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return apiError('UNAUTHORIZED', 'Invalid cron secret', 401);
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const abandonedCarts = await db.cart.findMany({
      where: {
        status: 'active',
        updatedAt: { lt: twentyFourHoursAgo },
        items: { some: {} },
      },
      include: {
        user: true,
        items: { include: { variant: { include: { product: true } } } },
      },
    });

    const mailer = getMailer();
    const sms = getSmsSender();
    let sent = 0;

    for (const cart of abandonedCarts) {
      if (!cart.user) continue;

      const items = cart.items.map(item => ({
        name: item.variant.product.name,
        size: item.variant.size,
        color: item.variant.color,
        price: formatMoney(item.priceSnapshot, { currency: INR }),
        qty: item.qty,
        url: `${process.env.NEXT_PUBLIC_APP_URL}/products/${item.variant.product.slug}`,
      }));

      const subtotal = items.reduce((sum, item) => sum + Number(item.price.replace(/[₹,]/g, '')) * item.qty, 0);

      try {
        if (cart.user.email) {
          await mailer.send({
            to: cart.user.email,
            subject: 'You left something in your bag 🛍️',
            html: `
              <h2>Hi ${cart.user.name},</h2>
              <p>Your cart is waiting for you:</p>
              <ul>
                ${items.map(item => `<li>${item.name} (${item.size}/${item.color}) - ${item.price} x ${item.qty}</li>`).join('')}
              </ul>
              <p>Subtotal: ${formatMoney(subtotal, { currency: INR })}</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/cart" style="background:#8B5CF6;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;">Complete Your Purchase</a>
            `,
          });
          sent++;
        }

        if (cart.user.phone) {
          await sms.send({
            to: cart.user.phone,
            body: `Hi ${cart.user.name}, you left ${items.length} item(s) in your LUMEN&CO cart. Complete your purchase: ${process.env.NEXT_PUBLIC_APP_URL}/cart`,
          });
          sent++;
        }

        const cartValue = cart.items.reduce((sum, item) => sum + item.priceSnapshot * item.qty, 0);
        await db.abandonedCart.upsert({
          where: { cartId: cart.id },
          create: { cartId: cart.id, userId: cart.userId!, value: cartValue, lastNudgeAt: new Date() },
          update: { lastNudgeAt: new Date(), stage: { increment: 1 } },
        });
      } catch (error) {
        console.error(`Failed to send abandoned cart for ${cart.id}:`, error);
      }
    }

    // Clean up old abandoned carts (7+ days)
    await db.cart.updateMany({
      where: { status: 'active', updatedAt: { lt: sevenDaysAgo } },
      data: { status: 'abandoned' },
    });

    return apiOk({ data: { processed: abandonedCarts.length, notificationsSent: sent } });
  } catch (error: any) {
    console.error('Abandoned carts cron error:', error);
    return apiError('INTERNAL_ERROR', 'Cron job failed', 500);
  }
}