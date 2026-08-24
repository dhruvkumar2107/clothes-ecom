import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { Input, Select, RadioGroup, RadioGroupItem, Label, Textarea } from '@/components/ui';
import { User, Mail, Phone, Calendar, Camera, Save, AlertCircle, CheckCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Profile Settings',
  description: 'Update your personal information and preferences',
};

export default async function ProfilePage() {
  const session = await getCustomerSession();

  if (!session) {
    redirect('/login?redirect=/account/profile');
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      phone: true,
      photoUrl: true,
      gender: true,
      dateOfBirth: true,
      locale: true,
      currency: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
    },
  });

  return (
    <div className="py-8 md:py-12">
      <div className="u-container">
        <div className="max-w-2xl mx-auto">
          <h1 className="u-display text-3xl mb-8">Profile Settings</h1>

          {/* Profile Form */}
          <form className="space-y-8">
            <div className="bg-paper rounded-lg border border-line p-6">
              <h2 className="u-display text-xl mb-6 flex items-center gap-2"><User className="w-5 h-5" /> Personal Information</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" defaultValue={user?.name} required />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" type="email" defaultValue={user?.email || ''} disabled />
                    {user?.emailVerifiedAt ? (
                      <p className="text-xs text-success mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Verified</p>
                    ) : (
                      <p className="text-xs text-warning mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Not verified</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" type="tel" defaultValue={user?.phone || ''} />
                    {user?.phoneVerifiedAt ? (
                      <p className="text-xs text-success mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Verified</p>
                    ) : (
                      <p className="text-xs text-warning mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Not verified</p>
                    )}
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    <Select defaultValue={user?.gender || 'unisex'}>
                      <RadioGroupItem value="men" label="Men" />
                      <RadioGroupItem value="women" label="Women" />
                      <RadioGroupItem value="unisex" label="Unisex" />
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" type="date" defaultValue={user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : ''} />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-paper rounded-lg border border-line p-6">
              <h2 className="u-display text-xl mb-6 flex items-center gap-2"><Mail className="w-5 h-5" /> Preferences</h2>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="locale">Language</Label>
                    <Select defaultValue={user?.locale || 'en'}>
                      <RadioGroupItem value="en" label="English" />
                      <RadioGroupItem value="hi" label="Hindi" />
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select defaultValue={user?.currency || 'INR'}>
                      <RadioGroupItem value="INR" label="₹ INR" />
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="marketing" defaultChecked={false} className="w-4 h-4 rounded border-line text-accent focus:ring-accent" />
                  <Label htmlFor="marketing" className="text-sm text-ink cursor-pointer">Receive marketing emails and promotional offers</Label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline">Cancel</Button>
              <Button>Save Changes</Button>
            </div>
          </form>

          {/* Security Section */}
          <div className="mt-10">
            <h2 className="u-display text-2xl mb-6">Security</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-5 bg-paper rounded-lg border border-line">
                <h3 className="font-medium mb-2">Change Password</h3>
                <p className="text-sm text-muted mb-4">Update your password to keep your account secure.</p>
                <Button variant="outline">Change Password</Button>
              </div>
              <div className="p-5 bg-paper rounded-lg border border-line">
                <h3 className="font-medium mb-2">Two-Factor Authentication</h3>
                <p className="text-sm text-muted mb-4">Add an extra layer of security to your account.</p>
                <Button variant="outline">Enable 2FA</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}