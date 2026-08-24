import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerSession } from '@/lib/auth/session';
import { resolveCart, findCart, getCartView, cartCount, addToCart, updateQty, removeFromCart, setSavedForLater, clearCart, applyCouponToCart, setCartNote } from '@/lib/cart';
import { apiOk, apiError } from '@/lib/api';

export async function GET(request: NextRequest) {
  const session = await getCustomerSession();
  const userId = session?.userId ?? null;

  const { searchParams } = new URL(request.url);
  const pincode = searchParams.get('pincode');
  const state = searchParams.get('state');
  const stateCode = searchParams.get('stateCode');
  const cod = searchParams.get('cod') === 'true';
  const walletRequested = parseInt(searchParams.get('walletRequested') || '0', 10);
  const loyaltyPointsRequested = parseInt(searchParams.get('loyaltyPointsRequested') || '0', 10);

  try {
    const view = await getCartView({
      userId,
      address: pincode ? { pincode, state, stateCode } : null,
      cod,
      walletRequested,
      loyaltyPointsRequested,
    });

    return apiOk({ data: view });
  } catch (error) {
    console.error('Cart GET error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load cart', 500);
  }
}

export async function POST(request: NextRequest) {
  const session = await getCustomerSession();
  const userId = session?.userId ?? null;

  try {
    const body = await request.json();
    const cart = await resolveCart(userId);

    const AddSchema = z.object({
      variantId: z.string().cuid(),
      qty: z.number().int().min(1).max(10).optional(),
    });

    const parsed = AddSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    await addToCart({ cartId: cart.id, variantId: parsed.data.variantId, qty: parsed.data.qty });

    const count = await cartCount(userId);
    return apiOk({ itemCount: count });
  } catch (error) {
    console.error('Cart POST error:', error);
    if (error && typeof error === 'object' && 'code' in error) {
      return apiError((error as any).code, (error as any).message, (error as any).status || 500);
    }
    return apiError('INTERNAL_ERROR', 'Failed to add to cart', 500);
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getCustomerSession();
  const userId = session?.userId ?? null;

  try {
    const body = await request.json();
    const cart = await resolveCart(userId);

    const UpdateSchema = z.object({
      itemId: z.string().cuid(),
      qty: z.number().int().min(0).max(10),
    });

    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    if (parsed.data.qty === 0) {
      await removeFromCart({ cartId: cart.id, itemId: parsed.data.itemId });
    } else {
      await updateQty({ cartId: cart.id, itemId: parsed.data.itemId, qty: parsed.data.qty });
    }

    const count = await cartCount(userId);
    return apiOk({ itemCount: count });
  } catch (error) {
    console.error('Cart PATCH error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to update cart', 500);
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getCustomerSession();
  const userId = session?.userId ?? null;

  try {
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');
    const action = searchParams.get('action');

    const cart = await resolveCart(userId);

    if (action === 'clear') {
      await clearCart(cart.id);
      return apiOk({ cleared: true });
    }

    if (action === 'saveForLater') {
      const saved = searchParams.get('saved') === 'true';
if (!itemId) return apiError('VALIDATION_ERROR', 'itemId required', 400);
      await setSavedForLater({ cartId: cart.id, itemId, saved });
      return apiOk({ saved });
    }

    if (action === 'coupon') {
      const code = searchParams.get('code');
      await applyCouponToCart(cart.id, code);
      return apiOk({ couponCode: code });
    }

    if (action === 'note') {
      const note = searchParams.get('note');
      await setCartNote(cart.id, note);
      return apiOk({ note });
    }

    if (!itemId) return apiError('VALIDATION_ERROR', 'itemId required', 400);
    await removeFromCart({ cartId: cart.id, itemId });

    const count = await cartCount(userId);
    return apiOk({ itemCount: count });
} catch (error) {
    console.error('Cart DELETE error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to update cart', 500);
  }
}