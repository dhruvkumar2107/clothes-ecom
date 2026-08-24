import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { signup, AccountError } from '@/lib/auth';
import { authRateLimit } from '@/lib/rate-limit';
import { apiError, apiOk } from '@/lib/api';

export const dynamic = 'force-dynamic';

const SignupSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  referralCode: z.string().optional(),
  gender: z.enum(['men', 'women', 'unisex']).optional(),
  dateOfBirth: z.string().datetime().optional(),
  marketingOptIn: z.boolean().optional(),
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone is required',
  path: ['email'],
});

export async function POST(request: NextRequest) {
  const rl = await authRateLimit(request, { limit: 5, window: '1m', keyPrefix: 'auth:signup' });
  if (rl.limited) return rl.response;

  try {
    const body = await request.json();
    const parsed = SignupSchema.safeParse(body);

    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const result = await signup(parsed.data);
    return apiOk({
      user: {
        id: result.userId,
        name: result.name,
        email: null, // We don't have email in SignupResult
        phone: null, // We don't have phone in SignupResult
        referralCode: result.referralCode,
      },
      needsVerification: result.isNew, // Using isNew as needsVerification
    }, { status: 201 });
  } catch (error) {
    if (error instanceof AccountError) {
      return apiError('ACCOUNT_ERROR', error.message, error.status);
    }
    console.error('Signup error:', error);
    return apiError('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}