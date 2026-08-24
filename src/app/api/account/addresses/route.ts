import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerSession, requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

const AddressSchema = z.object({
  label: z.enum(['home', 'work', 'other']).default('home'),
  name: z.string().min(1),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
  line1: z.string().min(1),
  line2: z.string().optional().nullable(),
  landmark: z.string().optional().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  stateCode: z.string().optional().nullable(),
  pincode: z.string().regex(/^\d{6}$/),
  country: z.string().default('IN'),
  isDefault: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const session = await requireCustomer();

  try {
    const addresses = await db.address.findMany({
      where: { userId: session.userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    return apiOk({ data: addresses });
  } catch (error) {
    console.error('Addresses list error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load addresses', 500);
  }
}

export async function POST(request: NextRequest) {
  const session = await requireCustomer();

  try {
    const body = await request.json();
    const parsed = AddressSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    // If this is set as default, unset other defaults
    if (parsed.data.isDefault) {
      await db.address.updateMany({
        where: { userId: session.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await db.address.create({
      data: {
        userId: session.userId,
        ...parsed.data,
      },
    });

    return apiOk({ data: address }, { status: 201 });
  } catch (error) {
    console.error('Create address error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to create address', 500);
  }
}