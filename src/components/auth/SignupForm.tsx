'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useToast } from '@/app/providers';
import { apiPost } from '@/lib/api-client';
import { Loader2, Mail, Lock, User, Eye, EyeOff, Shield, AlertCircle, CheckCircle, Gift, Smartphone } from 'lucide-react';

const PASSWORD_REQUIREMENTS = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
];

export function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    name: '',
    referralCode: '',
    marketingOptIn: true,
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeField, setActiveField] = useState<'email' | 'phone'>('email');

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({ title: 'Missing name', message: 'Please enter your name', tone: 'warning' });
      return false;
    }
    if (activeField === 'email' && !formData.email.trim()) {
      toast({ title: 'Missing email', message: 'Please enter your email', tone: 'warning' });
      return false;
    }
    if (activeField === 'phone' && !formData.phone.trim()) {
      toast({ title: 'Missing phone', message: 'Please enter your phone number', tone: 'warning' });
      return false;
    }
    if (!formData.password) {
      toast({ title: 'Missing password', message: 'Please enter a password', tone: 'warning' });
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      toast({ title: 'Passwords do not match', message: 'Please ensure both passwords are the same', tone: 'warning' });
      return false;
    }
    const unmet = PASSWORD_REQUIREMENTS.filter(r => !r.test(formData.password));
    if (unmet.length > 0) {
      toast({ title: 'Weak password', message: `Password must: ${unmet.map(r => r.label).join(', ')}`, tone: 'warning' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        password: formData.password,
        marketingOptIn: formData.marketingOptIn,
      };

      if (activeField === 'email') payload.email = formData.email.trim();
      else payload.phone = formData.phone.trim();

      if (formData.referralCode.trim()) payload.referralCode = formData.referralCode.trim().toUpperCase();

      const res = await apiPost<{ data: { needsVerification?: boolean } }>('/api/auth/signup', payload);

      if (res.data?.needsVerification) {
        router.push(`/login/verify?identifier=${encodeURIComponent(activeField === 'email' ? formData.email : formData.phone)}&redirect=/account`);
      } else {
        toast({ title: 'Account created!', message: 'Your account has been created successfully', tone: 'success' });
        router.push('/account');
      }
    } catch (error: any) {
      toast({ title: 'Signup failed', message: error.message || 'Please try again', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const metRequirements = PASSWORD_REQUIREMENTS.map(r => r.test(formData.password));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex gap-2 mb-2" role="tablist" aria-label="Contact method">
        <button
          type="button"
          role="tab"
          aria-selected={activeField === 'email'}
          onClick={() => setActiveField('email')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${activeField === 'email' ? 'bg-ink text-paper' : 'bg-paper border border-line text-ink hover:bg-ink-2'}`}
        >
          <Mail className="w-4 h-4 inline mr-1" /> Email
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeField === 'phone'}
          onClick={() => setActiveField('phone')}
          className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${activeField === 'phone' ? 'bg-ink text-paper' : 'bg-paper border border-line text-ink hover:bg-ink-2'}`}
        >
          <Smartphone className="w-4 h-4 inline mr-1" /> Phone
        </button>
      </div>

      {activeField === 'email' && (
        <div>
          <label htmlFor="email" className="u-label mb-1 block">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={e => handleChange('email', e.target.value)}
              className="pl-10"
              required
              autoComplete="email"
            />
          </div>
        </div>
      )}

      {activeField === 'phone' && (
        <div>
          <label htmlFor="phone" className="u-label mb-1 block">Phone Number</label>
          <div className="relative">
            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <Input
              id="phone"
              type="tel"
              placeholder="+91 98765 43210"
              value={formData.phone}
              onChange={e => handleChange('phone', e.target.value)}
              className="pl-10"
              required
              autoComplete="tel"
            />
          </div>
        </div>
      )}

      <div>
        <label htmlFor="name" className="u-label mb-1 block">Full Name</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <Input
            id="name"
            type="text"
            placeholder="Your name"
            value={formData.name}
            onChange={e => handleChange('name', e.target.value)}
            className="pl-10"
            required
            autoComplete="name"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="u-label mb-1 block">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Create a strong password"
            value={formData.password}
            onChange={e => handleChange('password', e.target.value)}
            className="pl-10 pr-10"
            required
            autoComplete="new-password"
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
        {formData.password && (
          <div className="mt-2 space-y-1">
            {PASSWORD_REQUIREMENTS.map((req, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-4 h-4 rounded border ${metRequirements[i] ? 'border-success bg-success' : 'border-line'}`}>
                  {metRequirements[i] && <CheckCircle className="w-3 h-3 text-paper" />}
                </span>
                <span className={metRequirements[i] ? 'text-success' : 'text-muted'}>{req.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="u-label mb-1 block">Confirm Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={e => handleChange('confirmPassword', e.target.value)}
            className="pl-10"
            required
            autoComplete="new-password"
          />
        </div>
      </div>

      <div>
        <label htmlFor="referralCode" className="u-label mb-1 block">Referral Code (Optional)</label>
        <div className="relative">
          <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <Input
            id="referralCode"
            type="text"
            placeholder="Enter referral code"
            value={formData.referralCode}
            onChange={e => handleChange('referralCode', e.target.value.toUpperCase())}
            className="pl-10 uppercase"
            maxLength={12}
          />
        </div>
        <p className="text-xs text-muted mt-1">Your friend gets ₹200 off, you earn ₹200 wallet credit</p>
      </div>

      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="marketing"
          checked={formData.marketingOptIn}
          onChange={e => handleChange('marketingOptIn', e.target.checked)}
          className="w-4 h-4 mt-0.5 rounded border-line text-accent focus:ring-accent"
        />
        <Label htmlFor="marketing" className="text-sm text-ink cursor-pointer">
          I'd like to receive updates about new collections, sales, and styling tips.
        </Label>
      </div>

      <div className="flex items-start gap-3">
        <input type="checkbox" id="terms" required className="w-4 h-4 mt-0.5 rounded border-line text-accent focus:ring-accent" />
        <Label htmlFor="terms" className="text-sm text-ink cursor-pointer">
          I agree to the <Link href="/terms" className="text-accent hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>.
        </Label>
      </div>

      <Button type="submit" className="w-full justify-center gap-2" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Creating account...
          </>
        ) : (
          <>
            <User className="w-5 h-5" />
            Create Account
          </>
        )}
      </Button>

      <p className="text-xs text-muted text-center">
        Protected by <Shield className="w-3 h-3 inline" /> reCAPTCHA • <Link href="/privacy" className="underline">Privacy</Link> • <Link href="/terms" className="underline">Terms</Link>
      </p>
    </form>
  );
}