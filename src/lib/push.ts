import { db } from '@/lib/db';
import webpush from 'web-push';

webpush.setVapidDetails(
  'mailto:admin@lumenandco.com',
  process.env.VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: any
): Promise<{ sent: number }> {
  try {
    const subscriptions = await db.pushSubscription.findMany({ where: { userId } });
    if (subscriptions.length === 0) return { sent: 0 };

    const payload = JSON.stringify({ title, body, data, timestamp: Date.now() });
    let sent = 0;

    for (const sub of subscriptions) {
      try {
        const keys = JSON.parse(sub.keysJson);
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
          payload
        );
        sent++;
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await db.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }

    return { sent };
  } catch (error) {
    console.error('Send push notification error:', error);
    return { sent: 0 };
  }
}

export async function sendPushNotificationToAll(
  title: string,
  body: string,
  data?: any
): Promise<{ sent: number }> {
  try {
    const subscriptions = await db.pushSubscription.findMany({});
    if (subscriptions.length === 0) return { sent: 0 };

    const payload = JSON.stringify({ title, body, data, timestamp: Date.now() });
    let sent = 0;

    for (const sub of subscriptions) {
      try {
        const keys = JSON.parse(sub.keysJson);
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
          payload
        );
        sent++;
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await db.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }

    return { sent };
  } catch (error) {
    console.error('Send push notification to all error:', error);
    return { sent: 0 };
  }
}