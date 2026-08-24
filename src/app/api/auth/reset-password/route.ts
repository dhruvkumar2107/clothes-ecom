import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resetPasswordWithToken, resetPasswordWithOtp } from '@/lib/auth/accounts';
import { authRateLimit } from '@/lib/rate-limit';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const ResetTokenSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const ResetOtpSchema = z.object({
  identifier: z.string().min(1),
  code: z.string().length(6, 'Code must be 6 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  const rl = await authRateLimit(request, { limit: 5, window: '15m', keyPrefix: 'auth:reset' });
  if (rl.limited) return rl.response;

  try {
    const body = await request.json();

    // Check if it's OTP-based reset
    if (body.code) {
      const parsed = ResetOtpSchema.safeParse(body);
      if (!parsed.success) {
        return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
      }
      await resetPasswordWithOtp({ challengeToken: '', code: parsed.data.code, password: parsed.data.password });
    } else {
      const parsed = ResetTokenSchema.safeParse(body);
      if (!parsed.success) {
        return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
      }
      await resetPasswordWithToken({ token: parsed.data.token, password: parsed.data.password });
    }

    return apiOk({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return apiError('INVALID_TOKEN', 'Invalid or expired reset token', 400);
  }
}