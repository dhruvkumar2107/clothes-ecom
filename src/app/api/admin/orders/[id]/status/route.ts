import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'Status is required.' }, { status: 400 });
    }

    const order = await prisma.order.update({
      where: { id },
      data: {
        status,
        ...(status === 'confirmed' ? { confirmedAt: new Date() } : {}),
        ...(status === 'delivered' ? { deliveredAt: new Date() } : {}),
        ...(status === 'cancelled' ? { cancelledAt: new Date() } : {}),
      },
    });

    await prisma.orderEvent.create({
      data: {
        orderId: id,
        status,
        title: `Order status updated to ${status.toUpperCase()}`,
        description: `Fulfillment status modified by administrator.`,
        customerVisible: true,
      },
    });

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('Error updating order status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update order status.' },
      { status: 500 }
    );
  }
}
