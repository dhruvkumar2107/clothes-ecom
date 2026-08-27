import { NextRequest, NextResponse } from 'next/server';

const wardrobeStore = new Map<string, { items: any[]; outfits: any[] }>();

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = req.headers.get('x-user-id') || 'anonymous';
    const data = wardrobeStore.get(userId) || { items: [], outfits: [] };
    data.items = data.items.filter((item: any) => item.id !== id);
    wardrobeStore.set(userId, data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to remove item' }, { status: 500 });
  }
}
