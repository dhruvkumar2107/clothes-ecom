import { NextRequest, NextResponse } from 'next/server';

const wardrobeStore = new Map<string, { items: any[]; outfits: any[] }>();

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || 'anonymous';
    const body = await req.json();
    
    const existing = wardrobeStore.get(userId) || { items: [], outfits: [] };
    const newOutfit = {
      id: Date.now().toString(),
      name: body.name,
      items: body.itemIds || [],
      createdAt: new Date().toISOString(),
    };
    existing.outfits.push(newOutfit);
    wardrobeStore.set(userId, existing);

    return NextResponse.json({ ok: true, data: newOutfit });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to create outfit' }, { status: 500 });
  }
}
