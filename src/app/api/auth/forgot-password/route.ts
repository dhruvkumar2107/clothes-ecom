import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset, requestPasswordResetOtp } from '@/lib/auth/accounts';
import { authRateLimit } from '@/lib/rate-limit';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const ForgotSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  channel: z.enum(['email', 'sms']).optional(),
});

export async function POST(request: NextRequest) {
  const rl = await authRateLimit(request, { limit: 3, window: '1h', keyPrefix: 'auth:forgot' });
  if (rl.limited) return rl.response;

  try {
    const body = await request.json();
    const parsed = ForgotSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    if (parsed.data.channel === 'sms') {
      await requestPasswordResetOtp({ channel: 'sms', destination: parsed.data.identifier });
    } else {
      await requestPasswordReset(parsed.data.identifier);
    }

    return apiOk({ sent: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    return apiOk({ sent: true }); // Always return success to prevent enumeration
  }
}