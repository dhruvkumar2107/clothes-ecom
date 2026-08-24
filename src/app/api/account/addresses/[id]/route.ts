import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerSession, requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

const UpdateAddressSchema = z.object({
  label: z.enum(['home', 'work', 'other']).optional(),
  name: z.string().min(1).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
  line1: z.string().min(1).optional(),
  line2: z.string().optional().nullable(),
  landmark: z.string().optional().nullable(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  stateCode: z.string().optional().nullable(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  country: z.string().default('IN').optional(),
  isDefault: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireCustomer();

  try {
    const { id } = await params;
    const address = await db.address.findFirst({
      where: { id, userId: session.userId },
    });

    if (!address) {
      return apiError('NOT_FOUND', 'Address not found', 404);
    }

    return apiOk({ data: address });
  } catch (error) {
    console.error('Address detail error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load address', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireCustomer();

  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = UpdateAddressSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const address = await db.address.findFirst({
      where: { id, userId: session.userId },
    });
    if (!address) {
      return apiError('NOT_FOUND', 'Address not found', 404);
    }

    if (parsed.data.isDefault) {
      await db.address.updateMany({
        where: { userId: session.userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await db.address.update({
      where: { id },
      data: parsed.data,
    });

    return apiOk({ data: updated });
  } catch (error) {
    console.error('Update address error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to update address', 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireCustomer();

  try {
    const { id } = await params;
    const address = await db.address.findFirst({
      where: { id, userId: session.userId },
    });
    if (!address) {
      return apiError('NOT_FOUND', 'Address not found', 404);
    }

    // Check if used in pending orders
    const usedInOrder = await db.order.findFirst({
      where: {
        userId: session.userId,
        status: { in: ['pending', 'confirmed', 'packed', 'shipped'] },
        shippingAddressJson: { contains: id },
      },
    });
    if (usedInOrder) {
      return apiError('ADDRESS_IN_USE', 'Cannot delete address used in active orders', 409);
    }

    await db.address.delete({ where: { id } });

    return apiOk({ deleted: true });
  } catch (error) {
    console.error('Delete address error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to delete address', 500);
  }
}