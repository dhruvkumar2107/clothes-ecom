import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { loginStaff } from '@/lib/auth/session';
import { authRateLimit } from '@/lib/rate-limit';
import { apiError, apiOk } from '@/lib/api';

export const dynamic = 'force-dynamic';

const StaffLoginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  if (!process.env.AUTH_SECRET?.trim()) {
    return apiError('SERVER_MISCONFIGURED', 'AUTH_SECRET env var is missing — admin login is disabled until it is set. Add it in the Render dashboard.', 500);
  }

  const rl = await authRateLimit(request, { limit: 10, window: '1m', keyPrefix: 'auth:staff-login' });
  if (rl.limited) return rl.response;

  try {
    const body = await request.json();
    const parsed = StaffLoginSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const { email, password } = parsed.data;

    const staff = await db.staffUser.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, passwordHash: true, status: true },
    });

    if (!staff || staff.status !== 'active') {
      return apiError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }

    const ok = await verifyPassword(password, staff.passwordHash);
    if (!ok) {
      return apiError('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
    }

    const session = await loginStaff(staff.id);

    return apiOk({
      staff: {
        id: session.staffId,
        name: session.name,
        email: session.email,
        role: session.roleSlug,
      },
    });
  } catch (error: any) {
    console.error('Staff login error:', error);
    const detail = process.env.NODE_ENV !== 'production' ? error?.message : undefined;
    return apiError('INTERNAL_ERROR', detail || 'An unexpected error occurred', 500);
  }
}
