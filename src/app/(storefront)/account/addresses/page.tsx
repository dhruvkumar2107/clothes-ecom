import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { AddressBook } from '@/components/account/AddressBook';

export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Addresses',
  description: 'Manage your delivery addresses',
};

export default async function AddressesPage() {
  const session = await getCustomerSession();
  if (!session) redirect('/login?redirect=/account/addresses');

  const addresses = await db.address.findMany({
    where: { userId: session.userId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      label: true,
      name: true,
      phone: true,
      line1: true,
      line2: true,
      landmark: true,
      city: true,
      state: true,
      stateCode: true,
      pincode: true,
      country: true,
      isDefault: true,
    },
  });

  return (
    <div className="py-8 md:py-12">
      <div className="u-container">
        {/* Editing is interactive, so the list is handed to a client component. */}
        <AddressBook initial={addresses} />
      </div>
    </div>
  );
}
