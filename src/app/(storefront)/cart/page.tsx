import { Metadata } from 'next';
import { CartPageClient } from '@/components/cart/CartPageClient';
import { getCartView } from '@/lib/cart';
import { getCustomerSession } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Shopping Bag',
  description: 'Review and manage your shopping bag',
};

export default async function CartPage() {
  const session = await getCustomerSession();
  const userId = session?.userId ?? null;

  const cartView = await getCartView({ userId });

  return <CartPageClient initialCart={cartView} />;
}