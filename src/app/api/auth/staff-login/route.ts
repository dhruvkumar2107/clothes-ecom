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
  'P1008',
  'P1011',
  'P1013',
  'P1017',
  'P2024',
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
]);

const DATABASE_SCHEMA_CODES = new Set(['P2021', 'P2022']);

function getDatabaseFailure(error: unknown): 'unavailable' | 'schema' | null {
  const pending: unknown[] = [error];
  const seen = new Set<object>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) continue;
    seen.add(current);

    const value = current as {
      code?: unknown;
      name?: unknown;
      cause?: unknown;
      meta?: unknown;
    };
    if (value.name === 'PrismaClientInitializationError') return 'unavailable';
    if (typeof value.code === 'string') {
      if (DATABASE_CONNECTION_CODES.has(value.code)) return 'unavailable';
      if (DATABASE_SCHEMA_CODES.has(value.code)) return 'schema';
    }
    pending.push(value.cause, value.meta);
  }

  return null;
}

export async function POST(request: NextRequest) {
  const authSecret = process.env.AUTH_SECRET?.trim();
  if (!authSecret || authSecret.length < 32) {
    return apiError(
      'SERVER_MISCONFIGURED',
      'Admin sign-in is not configured correctly. Set AUTH_SECRET to a value of at least 32 characters in the hosting environment.',
      503,
    );
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
    const databaseFailure = getDatabaseFailure(error);
    if (databaseFailure === 'unavailable') {
      return apiError(
        'DATABASE_UNAVAILABLE',
        'Admin sign-in cannot reach the database. Check that DATABASE_URL uses the correct Supabase transaction-pooler host, username, password, and port (6543), then retry.',
        503,
      );
    }
    if (databaseFailure === 'schema') {
      return apiError(
        'DATABASE_SCHEMA_UNAVAILABLE',
        'Admin sign-in cannot use the current database schema. Apply the Prisma schema to the configured database, then retry.',
        503,
      );
    }
    const detail = process.env.NODE_ENV !== 'production' && error instanceof Error
      ? error.message
      : undefined;
    return apiError('INTERNAL_ERROR', detail || 'An unexpected error occurred', 500);
  }
}
