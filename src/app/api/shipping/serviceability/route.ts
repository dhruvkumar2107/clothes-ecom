import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiOk, apiError, rateLimit } from '@/lib/api';
import { checkServiceability, codEligibility, isValidPincode } from '@/lib/shipping';

export const dynamic = 'force-dynamic';

const Query = z.object({
  pincode: z.string().trim(),
  /** Cart total in paise, when the caller wants the COD verdict too. */
  total: z.coerce.number().int().min(0).optional(),
  weight: z.coerce.number().int().min(0).max(50_000).optional(),
});

/**
 * "Do you deliver to my PIN code, and when?"
 *
 * Used by the address book, the PDP delivery promise and checkout. Anonymous by
 * design — a shopper must be able to check before creating an account — so it
 * carries its own rate limit.
 */
export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 60, window: '1m', keyPrefix: 'serviceability' });
  if (limited.limited) return limited.response!;

  const url = new URL(request.url);
  const parsed = Query.safeParse({
    pincode: url.searchParams.get('pincode') ?? '',
    total: url.searchParams.get('total') ?? undefined,
    weight: url.searchParams.get('weight') ?? undefined,
  });

  if (!parsed.success || !isValidPincode(parsed.data.pincode)) {
    return apiError('VALIDATION_ERROR', 'Enter a valid 6-digit PIN code', 400, { field: 'pincode' });
  }

  const { pincode, total, weight } = parsed.data;

  try {
    const serviceability = await checkServiceability(pincode, {
      weightGrams: weight,
      declaredValue: total,
    });

    // Only worth computing when the caller told us the cart value — COD limits
    // are value-dependent and a verdict without one would be misleading.
    const cod =
      total === undefined
        ? null
        : await codEligibility({ pincode, grandTotal: total, serviceability });

    return apiOk({ serviceability, cod });
  } catch (err) {
    console.error('[serviceability] lookup failed:', err);
    return apiError('INTERNAL_ERROR', 'Could not check this PIN code right now', 500);
  }
}
