import { NextRequest } from 'next/server';
import { getCustomerSession } from '@/lib/auth/session';
import { getWardrobe, setWardrobe } from '@/lib/wardrobe-store';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCustomerSession();
    if (!session?.userId) return apiError('UNAUTHORIZED', 'Login required', 401);

    const { id } = await params;
    const data = getWardrobe(session.userId);
    data.items = data.items.filter((item) => item.id !== id);
    setWardrobe(session.userId, data);
    return apiOk({ deleted: true });
  } catch {
    return apiError('INTERNAL_ERROR', 'Failed to remove item', 500);
  }
}
