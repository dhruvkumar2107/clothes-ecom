import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loginWithPassword, startOtpLogin, type LoginResult } from '@/lib/auth';
import { authRateLimit } from '@/lib/rate-limit';
import { apiError, apiOk } from '@/lib/api';

export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

const OtpLoginSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  channel: z.enum(['email', 'sms']),
});

export async function POST(request: NextRequest) {
  if (!process.env.AUTH_SECRET?.trim()) {
    return apiError('SERVER_MISCONFIGURED', 'AUTH_SECRET env var is missing — login is disabled until it is set. Add it in the Render dashboard.', 500);
  }

  const rl = await authRateLimit(request, { limit: 10, window: '1m', keyPrefix: 'auth:login' });
  if (rl.limited) return rl.response;

  try {
    const body = await request.json();

    // Check if it's OTP login
    if (body.channel) {
      const parsed = OtpLoginSchema.safeParse(body);
      if (!parsed.success) {
        return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
      }
      const result = await startOtpLogin({ channel: parsed.data.channel, destination: parsed.data.identifier });
      return apiOk({ sent: true, destination: result.maskedDestination }, { status: 200 });
    }

    // Password login
    const parsed = LoginSchema.safeParse(body);
if (!parsed.success) {
        return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
      }

    const result = await loginWithPassword({ identifier: parsed.data.identifier, password: parsed.data.password });

    return apiOk({
      user: {
        id: result.userId,
        name: result.name,
        email: null, // We don't have email in LoginResult, would need to fetch user
        phone: null, // We don't have phone in LoginResult
        photoUrl: null,
        loyaltyTier: result.loyaltyTier,
        referralCode: null,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    const detail = process.env.NODE_ENV !== 'production' ? error?.message : undefined;
    return apiError('INTERNAL_ERROR', detail || 'An unexpected error occurred', 500);
  }
}