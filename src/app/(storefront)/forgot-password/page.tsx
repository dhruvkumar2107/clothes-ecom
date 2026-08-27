import { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { getCustomerSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Forgot Password | LUMEN&CO',
  description: 'Reset your LUMEN&CO account password. Enter your email or phone to receive a reset link.',
};

export default async function ForgotPasswordPage() {
  const session = await getCustomerSession();

  if (session) {
    // Don't redirect, just show the form - they might be helping someone else
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
      <div className="u-container">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-6">
              <span className="u-display text-3xl font-light tracking-tight text-ink">LUMEN&CO</span>
            </Link>
            <h1 className="u-display text-3xl mb-2">Forgot Password?</h1>
            <p className="text-muted">Enter your email or phone and we\'ll send a reset link</p>
          </div>

          <ForgotPasswordForm />

          <div className="mt-6 text-center text-sm text-muted">
            <p>Remember your password? <Link href="/login" className="text-accent hover:underline font-medium">Sign in</Link></p>
          </div>

          <div className="mt-4 text-center">
            <Link href="/signup" className="text-sm text-accent hover:underline">Create an account instead</Link>
          </div>
        </div>
      </div>
    </div>
  );
}