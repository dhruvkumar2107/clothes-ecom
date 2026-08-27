import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiError } from '@/lib/api';
import { getCustomerSession, getStaffSession } from '@/lib/auth/session';
import { getInvoicePdfBuffer } from '@/lib/invoice';

export const dynamic = 'force-dynamic';

/**
 * GST tax invoice for one order.
 *
 * Reachable by the customer who placed the order, and by any signed-in staff
 * member for support. Ownership is checked with a scoped query so an id that
 * belongs to someone else is indistinguishable from one that does not exist.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const [customer, staff] = await Promise.all([getCustomerSession(), getStaffSession()]);
    if (!customer && !staff) {
      return apiError('AUTH_REQUIRED', 'Sign in to download this invoice', 401);
    }

    const order = await db.order.findFirst({
      where: staff ? { id } : { id, userId: customer!.userId },
      select: { id: true, orderNumber: true, paymentStatus: true },
    });
    if (!order) return apiError('NOT_FOUND', 'Order not found', 404);

    const pdf = await getInvoicePdfBuffer(order.id);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${order.orderNumber}.pdf"`,
        'Content-Length': String(pdf.byteLength),
        // Per-customer document — never let a shared cache hold it.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[invoice] generation failed:', err);
    return apiError('INTERNAL_ERROR', 'Could not generate the invoice', 500);
  }
}
