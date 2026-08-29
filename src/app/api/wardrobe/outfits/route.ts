import { NextRequest } from 'next/server';
import { getCustomerSession } from '@/lib/auth/session';
import { getWardrobe, setWardrobe, type WardrobeOutfit } from '@/lib/wardrobe-store';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getCustomerSession();
    if (!session?.userId) return apiError('UNAUTHORIZED', 'Login required', 401);

    const body = await req.json();
    const existing = getWardrobe(session.userId);
    const newOutfit: WardrobeOutfit = {
      id: Date.now().toString(),
      name: body.name,
      items: body.itemIds || [],
      createdAt: new Date().toISOString(),
    };
    existing.outfits.push(newOutfit);
    setWardrobe(session.userId, existing);

    return apiOk({ data: newOutfit });
  } catch {
    return apiError('INTERNAL_ERROR', 'Failed to create outfit', 500);
  }
}
