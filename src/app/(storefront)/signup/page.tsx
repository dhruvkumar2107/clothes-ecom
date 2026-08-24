import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCustomerSession } from '@/lib/auth/session';
import { SignupForm } from '@/components/auth/SignupForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Join LUMEN&CO and start shopping',
};

export default async function SignupPage() {
  const session = await getCustomerSession();

  if (session) {
    redirect('/account');
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
      <div className="u-container">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <Link href="/">
              <span className="u-display text-3xl font-light tracking-tight text-ink">LUMEN&CO</span>
            </Link>
            <h1 className="u-display text-3xl mb-2">Create Your Account</h1>
            <p className="text-muted">Join the collective and enjoy exclusive benefits</p>
          </div>

          <SignupForm />

          <div className="mt-6 text-center text-sm text-muted">
            <p>Already have an account? <Link href="/login" className="text-accent hover:underline font-medium">Sign in</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}