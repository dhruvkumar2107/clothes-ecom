import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtp } from '@/lib/auth/otp';
import { db } from '@/lib/db';
import { authRateLimit } from '@/lib/rate-limit';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const VerifyPhoneSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number'),
  code: z.string().length(6, 'Code must be 6 digits'),
});

export async function POST(request: NextRequest) {
  const rl = await authRateLimit(request, { limit: 10, window: '1m', keyPrefix: 'auth:verify-phone' });
  if (rl.limited) return rl.response;

  try {
    const body = await request.json();
    const parsed = VerifyPhoneSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    await verifyOtp({
      challengeToken: '', // This should come from the OTP issuance flow
      code: parsed.data.code,
      purpose: 'verify_phone',
    });

    await db.user.update({
      where: { phone: parsed.data.phone },
      data: { phoneVerifiedAt: new Date() },
    });

    return apiOk({ verified: true });
  } catch (error) {
    console.error('Verify phone error:', error);
    return apiError('INVALID_CODE', 'Invalid or expired code', 400);
  }
}