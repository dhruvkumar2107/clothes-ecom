import { NextResponse } from 'next/server';
import { getCustomerSession } from '@/lib/auth/session';
import { apiOk, apiError } from '@/lib/api';

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return apiError('UNAUTHORIZED', 'Not authenticated', 401);
  }

  return apiOk({
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      phone: session.phone,
      photoUrl: session.photoUrl,
      status: session.status,
      loyaltyTier: session.loyaltyTier,
      referralCode: session.referralCode,
      currency: session.currency,
      locale: session.locale,
    },
  });
}