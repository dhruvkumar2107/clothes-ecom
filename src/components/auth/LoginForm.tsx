'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/app/providers';
import { apiPost } from '@/lib/api-client';
import { Loader2, Mail, Lock, Eye, EyeOff, Smartphone } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
  const [otpChannel, setOtpChannel] = useState<'email' | 'sms'>('email');

  const redirectTo = searchParams.get('redirect') || '/account';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || (loginMethod === 'password' && !password)) {
      toast({ title: 'Missing fields', message: 'Please fill in all required fields', tone: 'warning' });
      return;
    }

    setLoading(true);
    try {
      if (loginMethod === 'otp') {
        await apiPost('/api/auth/login', { identifier, channel: otpChannel });
        toast({ title: 'Code sent', message: `We've sent a 6-digit code to your ${otpChannel}`, tone: 'success' });
        router.push(`/login/verify?identifier=${encodeURIComponent(identifier)}&channel=${otpChannel}&redirect=${encodeURIComponent(redirectTo)}`);
      } else {
        const res = await apiPost<{ data: { needsVerification?: boolean } }>('/api/auth/login', { identifier, password, rememberMe });
        if (res.data?.needsVerification) {
          router.push(`/login/verify?identifier=${encodeURIComponent(identifier)}&redirect=${encodeURIComponent(redirectTo)}`);
        } else {
          toast({ title: 'Welcome back!', message: 'You have been signed in successfully', tone: 'success' });
          router.push(redirectTo);
        }
      }
    } catch (error: any) {
      toast({ title: 'Login failed', message: error.message || 'Invalid credentials', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex gap-2 mb-2" role="tablist" aria-label="Login method">
        <button
          type="button"
          role="tab"
          aria-selected={loginMethod === 'password'}
          onClick={() => setLoginMethod('password')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${loginMethod === 'password' ? 'bg-ink text-paper' : 'bg-paper border border-line text-ink hover:bg-ink-2'}`}
        >
          <Mail className="w-4 h-4 inline mr-1" /> Password
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={loginMethod === 'otp'}
          onClick={() => setLoginMethod('otp')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${loginMethod === 'otp' ? 'bg-ink text-paper' : 'bg-paper border border-line text-ink hover:bg-ink-2'}`}
        >
          <Smartphone className="w-4 h-4 inline mr-1" /> OTP
        </button>
      </div>

      <div>
        <label htmlFor="identifier" className="u-label mb-1 block">
          {loginMethod === 'password' ? 'Email or Phone' : 'Email or Phone'}
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <Input
            id="identifier"
            type={loginMethod === 'password' ? 'text' : 'text'}
            placeholder="Enter your email or phone"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            className="pl-10"
            required
            autoComplete={loginMethod === 'password' ? 'username' : 'tel'}
          />
        </div>
      </div>

      {loginMethod === 'password' && (
        <div>
          <label htmlFor="password" className="u-label mb-1 block">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="pl-10 pr-10"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>
      )}

      {loginMethod === 'otp' && (
        <div>
          <label className="u-label mb-1 block">Send code via</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOtpChannel('email')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${otpChannel === 'email' ? 'bg-ink text-paper' : 'bg-paper border border-line text-ink hover:bg-ink-2'}`}
            >
              <Mail className="w-4 h-4 inline mr-1" /> Email
            </button>
            <button
              type="button"
              onClick={() => setOtpChannel('sms')}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${otpChannel === 'sms' ? 'bg-ink text-paper' : 'bg-paper border border-line text-ink hover:bg-ink-2'}`}
            >
              <Smartphone className="w-4 h-4 inline mr-1" /> SMS
            </button>
          </div>
        </div>
      )}

      {loginMethod === 'password' && (
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-line text-accent focus:ring-accent"
            />
            <span className="text-sm text-muted">Remember me</span>
          </label>
          <Link href="/forgot-password" className="text-sm text-accent hover:underline">Forgot password?</Link>
        </div>
      )}

      <Button type="submit" className="w-full justify-center gap-2" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Please wait...
          </>
        ) : loginMethod === 'otp' ? (
          <>
            <Smartphone className="w-5 h-5" />
            Send Code
          </>
        ) : (
          <>
            <Mail className="w-5 h-5" />
            Sign In
          </>
        )}
      </Button>
    </form>
  );
}