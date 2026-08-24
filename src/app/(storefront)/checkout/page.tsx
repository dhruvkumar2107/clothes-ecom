import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CheckoutClient } from '@/components/checkout/CheckoutClient';
import { getCartView } from '@/lib/cart';
import { getCustomerSession } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete your purchase securely',
};

export default async function CheckoutPage() {
  const session = await getCustomerSession();
  const userId = session?.userId ?? null;

  const cartView = await getCartView({ userId });

  if (!cartView.cartId || cartView.lines.length === 0) {
    return redirect('/cart');
  }

  // Get user addresses
  let addresses: any[] = [];
  if (userId) {
    addresses = await db.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  return <CheckoutClient initialCart={cartView} addresses={addresses} userId={userId} />;
}