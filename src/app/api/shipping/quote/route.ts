import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiOk, apiError, rateLimit } from '@/lib/api';
import { getCustomerSession } from '@/lib/auth/session';
import { getCartView } from '@/lib/cart';
import { checkServiceability, codEligibility, isValidPincode, quoteShipping } from '@/lib/shipping';

export const dynamic = 'force-dynamic';

const Query = z.object({
  pincode: z.string().trim().optional(),
  state: z.string().trim().max(64).optional(),
  cod: z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .optional(),
});

/**
 * Shipping cost and delivery window for the caller's own cart.
 *
 * The subtotal is read from the cart rather than accepted as a parameter —
 * free-shipping thresholds hang off it, so a client-supplied figure would let
 * anyone quote themselves free delivery.
 */
export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 60, window: '1m', keyPrefix: 'shipping-quote' });
  if (limited.limited) return limited.response!;

  const url = new URL(request.url);
  const parsed = Query.safeParse({
    pincode: url.searchParams.get('pincode') ?? undefined,
    state: url.searchParams.get('state') ?? undefined,
    cod: url.searchParams.get('cod') ?? undefined,
  });

  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 'Invalid shipping parameters', 400);
  }

  const { pincode, state } = parsed.data;
  const cod = parsed.data.cod ?? false;

  if (pincode && !isValidPincode(pincode)) {
    return apiError('VALIDATION_ERROR', 'Enter a valid 6-digit PIN code', 400, { field: 'pincode' });
  }

  try {
    const session = await getCustomerSession();
    const cart = await getCartView({ userId: session?.userId ?? null });

    const { subtotal, grandTotal } = cart.totals;

    const [quote, serviceability] = await Promise.all([
      quoteShipping({ pincode: pincode ?? null, state, subtotal, cod }),
      pincode ? checkServiceability(pincode, { declaredValue: subtotal }) : Promise.resolve(null),
    ]);

    const codVerdict = pincode
      ? await codEligibility({ pincode, grandTotal, serviceability })
      : null;

    return apiOk({ quote, serviceability, cod: codVerdict, subtotal });
  } catch (err) {
    console.error('[shipping quote] failed:', err);
    return apiError('INTERNAL_ERROR', 'Could not quote shipping right now', 500);
  }
}
