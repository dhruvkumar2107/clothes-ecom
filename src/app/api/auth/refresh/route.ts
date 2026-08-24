import { NextResponse } from 'next/server';
import { getCustomerSession, createCustomerSession } from '@/lib/auth/session';
import { apiOk, apiError } from '@/lib/api';

export async function POST() {
  const session = await getCustomerSession();
  if (!session) {
    return apiError('UNAUTHORIZED', 'No active session', 401);
  }

  const { token, expiresAt } = await createCustomerSession(session.userId);
  const jar = await (await import('next/headers')).cookies();
  jar.set('lmn_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://'),
    expires: expiresAt,
  });

  return apiOk({ refreshed: true });
}