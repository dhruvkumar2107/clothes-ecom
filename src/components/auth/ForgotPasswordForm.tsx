'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail, Smartphone, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiPost } from '@/lib/api-client';
import { useToast } from '@/app/providers';

type Step = 'contact' | 'verify' | 'reset' | 'done';
type Channel = 'email' | 'phone';

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
}

export function ForgotPasswordForm({ onSuccess }: ForgotPasswordFormProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('contact');
  const [channel, setChannel] = useState<Channel>('email');
  const [contact, setContact] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim() || loading) return;

    setLoading(true);
    try {
      await apiPost('/auth/forgot-password', {
        channel,
        destination: contact.trim(),
      });
      setStep('verify');
      setResendTimer(60);
      toast({ title: 'Code sent', message: `We've sent a 6-digit code to your ${channel}`, tone: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', message: error.message || 'Failed to send code', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6 || loading) return;

    setLoading(true);
    try {
      await apiPost('/auth/verify-otp', {
        channel,
        destination: contact,
        code: otp,
        purpose: 'reset',
      });
      setStep('reset');
      toast({ title: 'Verified', message: 'You can now set a new password', tone: 'success' });
    } catch (error: any) {
      toast({ title: 'Invalid code', message: error.message || 'Please check and try again', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || loading) return;
    setLoading(true);
    try {
      await apiPost('/auth/forgot-password', {
        channel,
        destination: contact,
      });
      setResendTimer(60);
      toast({ title: 'Code resent', message: 'A new code has been sent', tone: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', message: error.message || 'Failed to resend', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8 || password !== confirmPassword || loading) return;

    setLoading(true);
    try {
      await apiPost('/auth/reset-password', {
        channel,
        destination: contact,
        code: otp,
        password,
      });
      setStep('done');
      toast({ title: 'Password updated', message: 'Your password has been changed. You can now sign in.', tone: 'success' });
      onSuccess?.();
    } catch (error: any) {
      toast({ title: 'Error', message: error.message || 'Failed to reset password', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  // Resend timer countdown
  if (step === 'verify' && resendTimer > 0) {
    setTimeout(() => setResendTimer(t => t - 1), 1000);
  }

  const contactLabel = channel === 'email' ? 'Email address' : 'Phone number';
  const contactPlaceholder = channel === 'email' ? 'you@example.com' : '9876543210';
  const ContactIcon = channel === 'email' ? Mail : Smartphone;

  if (step === 'done') {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-success" aria-hidden="true" />
        </div>
        <h2 className="u-display text-xl mb-2">Password reset complete</h2>
        <p className="text-muted mb-6">Your password has been updated successfully.</p>
        <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={step === 'contact' ? handleContactSubmit : step === 'verify' ? handleVerifySubmit : handleResetSubmit} className="space-y-5">
      {/* Channel selector */}
      <div className="flex gap-2" role="radiogroup" aria-label="Reset via">
        <label className={`flex-1 p-3 rounded-lg border-2 text-center cursor-pointer transition-colors ${
          channel === 'email' ? 'border-accent bg-accent/5' : 'border-line hover:border-ink/50'
        }`}>
          <input type="radio" name="channel" value="email" checked={channel === 'email'} onChange={() => setChannel('email')} className="sr-only" />
          <div className="flex items-center justify-center gap-2">
            <Mail className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">Email</span>
          </div>
        </label>
        <label className={`flex-1 p-3 rounded-lg border-2 text-center cursor-pointer transition-colors ${
          channel === 'phone' ? 'border-accent bg-accent/5' : 'border-line hover:border-ink/50'
        }`}>
          <input type="radio" name="channel" value="phone" checked={channel === 'phone'} onChange={() => setChannel('phone')} className="sr-only" />
          <div className="flex items-center justify-center gap-2">
            <Smartphone className="w-5 h-5" aria-hidden="true" />
            <span className="font-medium">Phone</span>
          </div>
        </label>
      </div>

      {/* Step 1: Contact */}
      {step === 'contact' && (
        <>
          <div className="relative">
            <ContactIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" aria-hidden="true" />
            <Input
              type={channel === 'email' ? 'email' : 'tel'}
              placeholder={contactPlaceholder}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="pl-12"
              required
              autoComplete={channel === 'email' ? 'email' : 'tel'}
              inputMode={channel === 'email' ? 'email' : 'tel'}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !contact.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Code'}
          </Button>
        </>
      )}

      {/* Step 2: Verify OTP */}
      {step === 'verify' && (
        <>
          <p className="text-sm text-muted text-center">
            Enter the 6-digit code sent to <strong>{contact}</strong>
          </p>
          <div className="flex gap-3">
            {[...Array(6)].map((_, i) => (
              <input
                key={i}
                type="text"
                maxLength={1}
                value={otp[i] || ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setOtp(prev => prev.slice(0, i) + val + prev.slice(i + 1));
                  if (val && i < 5) {
                    (document.getElementById(`otp-${i + 1}`) as HTMLInputElement)?.focus();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !otp[i] && i > 0) {
                    (document.getElementById(`otp-${i - 1}`) as HTMLInputElement)?.focus();
                  }
                }}
                id={`otp-${i}`}
                className="w-12 h-12 text-center text-2xl font-medium border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
              />
            ))}
          </div>
          <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify Code'}
          </Button>
          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendTimer > 0 || loading}
              className="text-sm text-muted hover:text-ink transition-colors disabled:opacity-50"
            >
              {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend code'}
            </button>
          </div>
          <p className="text-xs text-muted-2 text-center mt-2">
            Didn't receive it? <button type="button" onClick={() => setStep('contact')} className="text-accent hover:underline">Change contact method</button>
          </p>
        </>
      )}

      {/* Step 3: New Password */}
      {step === 'reset' && (
        <>
          <p className="text-sm text-muted text-center mb-2">Your new password must be at least 8 characters.</p>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" aria-hidden="true" />
            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-12"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" aria-hidden="true" />
            <Input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-12"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-sm text-danger" role="alert">Passwords don't match</p>
          )}
          <Button type="submit" className="w-full" disabled={loading || password.length < 8 || password !== confirmPassword}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
          </Button>
        </>
      )}
    </form>
  );
}