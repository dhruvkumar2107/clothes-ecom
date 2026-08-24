import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSession, requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

export async function GET(request: NextRequest) {
  const session = await requireCustomer();

  try {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        photoUrl: true,
        gender: true,
        dateOfBirth: true,
        locale: true,
        currency: true,
        loyaltyTier: true,
        loyaltyPoints: true,
        referralCode: true,
        createdAt: true,
        _count: {
          select: { orders: true, addresses: true, wishlist: true, reviews: true },
        },
        addresses: {
          where: { isDefault: true },
          take: 1,
          select: { id: true, label: true, name: true, phone: true, line1: true, city: true, state: true, pincode: true, country: true },
        },
      },
    });

    if (!user) {
      return apiError('NOT_FOUND', 'User not found', 404);
    }

    const wallet = await db.wallet.findUnique({
      where: { userId: session.userId },
      select: { balance: true, lockedBalance: true, totalEarned: true, totalWithdrawn: true },
    });

    return apiOk({
      data: {
        ...user,
        wallet,
      },
    });
  } catch (error) {
    console.error('Account profile error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load profile', 500);
  }
}