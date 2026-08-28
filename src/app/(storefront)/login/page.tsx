import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCustomerSession } from '@/lib/auth/session';
import { LoginForm } from '@/components/auth/LoginForm';

export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to your LUMEN&CO account',
};

export default async function LoginPage() {
  const session = await getCustomerSession();

  if (session) {
    redirect('/account');
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12">
      <div className="u-container">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <Link href="/" className="inline-block mb-6">
              <span className="u-display text-3xl font-light tracking-tight text-ink">LUMEN&CO</span>
            </Link>
            <h1 className="u-display text-3xl mb-2">Welcome Back</h1>
            <p className="text-muted">Sign in to your account to continue</p>
          </div>

          <LoginForm />

          <div className="mt-6 text-center text-sm text-muted">
            <p>Don't have an account? <Link href="/signup" className="text-accent hover:underline font-medium">Sign up</Link></p>
          </div>

          <div className="mt-4 text-center">
            <Link href="/forgot-password" className="text-sm text-accent hover:underline">Forgot password?</Link>
          </div>
        </div>
      </div>
    </div>
  );
}