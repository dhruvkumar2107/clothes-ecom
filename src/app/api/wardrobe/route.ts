import { NextRequest, NextResponse } from 'next/server';

// In-memory store (replace with database in production)
const wardrobeStore = new Map<string, { items: any[]; outfits: any[] }>();

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || 'anonymous';
    const data = wardrobeStore.get(userId) || { items: [], outfits: [] };
    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load wardrobe' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id') || 'anonymous';
    const body = await req.json();
    
    const existing = wardrobeStore.get(userId) || { items: [], outfits: [] };
    const newItem = {
      id: Date.now().toString(),
      ...body,
      addedAt: new Date().toISOString(),
      purchased: body.purchased || false,
    };
    existing.items.push(newItem);
    wardrobeStore.set(userId, existing);

    return NextResponse.json({ ok: true, data: newItem });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to add item' }, { status: 500 });
  }
}
