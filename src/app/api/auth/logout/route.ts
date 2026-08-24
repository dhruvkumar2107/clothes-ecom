import { NextResponse } from 'next/server';
import { logoutCustomer, getCustomerSession } from '@/lib/auth/session';
import { apiOk } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getCustomerSession();
  if (session) {
    await logoutCustomer();
  }
  return apiOk({ success: true });
}