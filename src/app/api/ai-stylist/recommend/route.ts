import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, category, color } = body;

    if (!productId || !category || !color) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    // TODO: Integrate with actual recommendation engine
    // For now, return curated outfit recommendations
    const recommendations = [
      {
        id: 'rec-1',
        name: 'Office Elegance',
        items: [
          { id: productId, name: 'Selected Item', imageUrl: '', slug: '', price: 4999, category, color },
          { id: 'acc-1', name: 'Tailored Trousers', imageUrl: '', slug: 'tailored-trousers', price: 3499, category: 'bottoms', color: 'Navy' },
          { id: 'acc-2', name: 'Structured Blazer', imageUrl: '', slug: 'structured-blazer', price: 6999, category: 'outerwear', color: 'Black' },
          { id: 'acc-3', name: 'Leather Oxford Shoes', imageUrl: '', slug: 'leather-oxford', price: 5499, category: 'shoes', color: 'Brown' },
        ],
        total: 20996,
        reasoning: 'A polished ensemble pairing your piece with tailored staples for the modern professional.',
      },
      {
        id: 'rec-2',
        name: 'Weekend Relaxed',
        items: [
          { id: productId, name: 'Selected Item', imageUrl: '', slug: '', price: 4999, category, color },
          { id: 'acc-4', name: 'Relaxed Chinos', imageUrl: '', slug: 'relaxed-chinos', price: 2499, category: 'bottoms', color: 'Khaki' },
          { id: 'acc-5', name: 'Minimal Sneakers', imageUrl: '', slug: 'minimal-sneakers', price: 4499, category: 'shoes', color: 'White' },
        ],
        total: 11997,
        reasoning: 'A laid-back look that lets your selected piece shine with effortless weekend style.',
      },
      {
        id: 'rec-3',
        name: 'Evening Statement',
        items: [
          { id: productId, name: 'Selected Item', imageUrl: '', slug: '', price: 4999, category, color },
          { id: 'acc-6', name: 'Silk Midi Skirt', imageUrl: '', slug: 'silk-midi-skirt', price: 4999, category: 'bottoms', color: 'Black' },
          { id: 'acc-7', name: 'Strappy Heels', imageUrl: '', slug: 'strappy-heels', price: 5999, category: 'shoes', color: 'Gold' },
          { id: 'acc-8', name: 'Statement Earrings', imageUrl: '', slug: 'statement-earrings', price: 1999, category: 'accessories', color: 'Gold' },
        ],
        total: 17996,
        reasoning: 'Elevate your piece for evening occasions with luxe textures and metallic accents.',
      },
    ];

    return NextResponse.json({ ok: true, data: recommendations });
  } catch {
    return NextResponse.json({ ok: false, error: 'Recommendation failed' }, { status: 500 });
  }
}
