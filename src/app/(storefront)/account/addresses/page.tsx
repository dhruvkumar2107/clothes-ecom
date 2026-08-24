import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCustomerSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select, RadioGroup, RadioGroupItem, Label } from '@/components/ui';
import { Plus, MapPin, Trash2, Edit, Check } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Addresses',
  description: 'Manage your delivery addresses',
};

export default async function AddressesPage() {
  const session = await getCustomerSession();

  if (!session) {
    redirect('/login?redirect=/account/addresses');
  }

  const addresses = await db.address.findMany({
    where: { userId: session.userId },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });

  return (
    <div className="py-8 md:py-12">
      <div className="u-container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="u-display text-3xl mb-1">Saved Addresses</h1>
            <p className="text-muted">Manage your delivery addresses for faster checkout</p>
          </div>
        </div>

        {addresses.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-ink/10 flex items-center justify-center">
              <MapPin className="w-8 h-8 text-muted" />
            </div>
            <h2 className="u-display text-xl mb-2">No addresses saved</h2>
            <p className="text-muted mb-6">Add an address to speed up checkout</p>
            <Button onClick={() => document.getElementById('new-address')?.scrollIntoView()}>Add Address</Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {addresses.map((addr) => (
              <div key={addr.id} className={`relative p-5 bg-paper rounded-lg border-2 transition-colors ${addr.isDefault ? 'border-accent bg-accent/5' : 'border-line hover:border-ink/50'}`}>
                {addr.isDefault && (
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-accent text-paper text-xs rounded-full font-medium">Default</span>
                )}
                <address className="not-italic">
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-medium text-ink">{addr.name}</span>
                    <div className="flex gap-1">
                      <button className="p-1 text-muted hover:text-ink transition-colors" aria-label="Edit address"><Edit className="w-4 h-4" /></button>
                      <button className="p-1 text-muted hover:text-danger transition-colors" aria-label="Delete address"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="text-sm text-muted mb-1">{addr.phone}</p>
                  <p className="text-sm text-muted mb-1">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                  {addr.landmark && <p className="text-sm text-muted mb-1">{addr.landmark}</p>}
                  <p className="text-sm text-muted">{addr.city}, {addr.state} {addr.pincode}</p>
                </address>
              </div>
            ))}
          </div>
        )}

        {/* Add New Address Form */}
        <div id="new-address" className="mt-10 p-6 bg-paper rounded-lg border border-line">
          <h2 className="u-display text-xl mb-6 flex items-center gap-2"><Plus className="w-5 h-5" /> Add New Address</h2>
          <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); }}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="addr-name">Full Name *</Label>
                <Input id="addr-name" required />
              </div>
              <div>
                <Label htmlFor="addr-phone">Phone *</Label>
                <Input id="addr-phone" type="tel" required />
              </div>
            </div>
            <div>
              <Label htmlFor="addr-line1">Address Line 1 *</Label>
              <Input id="addr-line1" required />
            </div>
            <div>
              <Label htmlFor="addr-line2">Address Line 2</Label>
              <Input id="addr-line2" />
            </div>
            <div>
              <Label htmlFor="addr-landmark">Landmark</Label>
              <Input id="addr-landmark" />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="addr-city">City *</Label>
                <Input id="addr-city" required />
              </div>
              <div>
                <Label htmlFor="addr-state">State *</Label>
                <Input id="addr-state" required />
              </div>
              <div>
                <Label htmlFor="addr-pincode">PIN Code *</Label>
                <Input id="addr-pincode" maxLength={6} required />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Label htmlFor="addr-label">Address Type</Label>
              <RadioGroup defaultValue="home">
                <RadioGroupItem value="home" label="Home" />
                <RadioGroupItem value="work" label="Work" />
                <RadioGroupItem value="other" label="Other" />
              </RadioGroup>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="addr-default" className="w-4 h-4 rounded border-line text-accent focus:ring-accent" />
              <Label htmlFor="addr-default" className="text-sm text-muted cursor-pointer">Set as default address</Label>
            </div>
            <Button type="submit" className="w-full sm:w-auto">Save Address</Button>
          </form>
        </div>
      </div>
    </div>
  );
}