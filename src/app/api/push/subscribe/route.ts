import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSession, requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

function getWebpush() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys not configured');
  }
  webpush.setVapidDetails(
    'mailto:admin@lumenandco.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return webpush;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireCustomer();
    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return apiError('VALIDATION_ERROR', 'Invalid subscription data', 400);
    }

    const subscription = await db.pushSubscription.upsert({
      where: { endpoint },
      update: { keysJson: JSON.stringify(keys), userId: session.userId },
      create: { userId: session.userId, endpoint, keysJson: JSON.stringify(keys) },
    });

    return apiOk({ data: subscription });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Push subscribe error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to subscribe', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireCustomer();
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return apiError('VALIDATION_ERROR', 'endpoint parameter required', 400);
    }

    await db.pushSubscription.deleteMany({ where: { userId: session.userId, endpoint } });
    return apiOk({ data: { unsubscribed: true } });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Push unsubscribe error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to unsubscribe', 500);
  }
}