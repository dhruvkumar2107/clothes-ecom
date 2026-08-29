import { NextRequest } from 'next/server';
import { getCustomerSession } from '@/lib/auth/session';
import { getWardrobe, setWardrobe, type WardrobeItem } from '@/lib/wardrobe-store';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getCustomerSession();
    if (!session?.userId) return apiError('UNAUTHORIZED', 'Login required', 401);

    const data = getWardrobe(session.userId);
    return apiOk({ data });
  } catch {
    return apiError('INTERNAL_ERROR', 'Failed to load wardrobe', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCustomerSession();
    if (!session?.userId) return apiError('UNAUTHORIZED', 'Login required', 401);

    const body = await req.json();
    const existing = getWardrobe(session.userId);
    const newItem: WardrobeItem = {
      id: Date.now().toString(),
      ...body,
      addedAt: new Date().toISOString(),
      purchased: body.purchased || false,
    };
    existing.items.push(newItem);
    setWardrobe(session.userId, existing);

    return apiOk({ data: newItem });
  } catch {
    return apiError('INTERNAL_ERROR', 'Failed to add item', 500);
  }
}
