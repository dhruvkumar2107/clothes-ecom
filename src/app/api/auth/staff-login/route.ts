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

const DATABASE_CONNECTION_CODES = new Set([
  'P1000',
  'P1001',
  'P1002',
  'P1003',
  'P1017',
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
]);

function isDatabaseUnavailable(error: unknown): boolean {
  let current = error;
  while (current && typeof current === 'object') {
    const value = current as { code?: unknown; name?: unknown; cause?: unknown };
    if (
      value.name === 'PrismaClientInitializationError' ||
      (typeof value.code === 'string' && DATABASE_CONNECTION_CODES.has(value.code))
    ) {
      return true;
    }
    current = value.cause;
  }
  return false;
}

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
  } catch (error: unknown) {
    console.error('Staff login error:', error);
    if (isDatabaseUnavailable(error)) {
      return apiError(
        'DATABASE_UNAVAILABLE',
        'Admin sign-in is temporarily unavailable because the database connection failed. Check the DATABASE_URL configured for this service, then retry.',
        503,
      );
    }
    const detail = process.env.NODE_ENV !== 'production' && error instanceof Error
      ? error.message
      : undefined;
    return apiError('INTERNAL_ERROR', detail || 'An unexpected error occurred', 500);
  }
}
