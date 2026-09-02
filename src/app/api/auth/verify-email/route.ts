import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtp } from '@/lib/auth/otp';
import { db } from '@/lib/db';
import { authRateLimit } from '@/lib/rate-limit';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const VerifyEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Code must be 6 digits'),
  challengeToken: z.string().min(1, 'Challenge token is required'),
});

export async function POST(request: NextRequest) {
  const rl = await authRateLimit(request, { limit: 10, window: '1m', keyPrefix: 'auth:verify-email' });
  if (rl.limited) return rl.response;

  try {
    const body = await request.json();
    const parsed = VerifyEmailSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const result = await verifyOtp({
      challengeToken: parsed.data.challengeToken,
      code: parsed.data.code,
      purpose: 'verify_email',
    });

    await db.user.update({
      where: { email: parsed.data.email },
      data: { emailVerifiedAt: new Date() },
    });

    return apiOk({ verified: true });
  } catch (error) {
    console.error('Verify email error:', error);
    return apiError('INVALID_CODE', 'Invalid or expired code', 400);
  }
}