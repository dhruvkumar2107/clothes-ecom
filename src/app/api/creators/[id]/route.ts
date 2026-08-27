import { NextRequest, NextResponse } from 'next/server';

const creatorsData: Record<string, any> = {
  '1': {
    creator: {
      id: '1',
      name: 'Ananya Sharma',
      handle: '@ananyastyle',
      avatarUrl: '',
      bio: 'Fashion editor and sustainable style advocate. Curating pieces that last beyond seasons.',
      followerCount: 245000,
      curatedCount: 42,
      verified: true,
      tags: ['Sustainable', 'Minimal', 'Workwear'],
    },
    products: [
      { id: 'p1', name: 'Signature Blazer', imageUrl: '', slug: 'signature-blazer', price: 9999, curatorNote: 'My go-to piece for meetings and dinners alike.' },
      { id: 'p2', name: 'Linen Trousers', imageUrl: '', slug: 'linen-trousers', price: 3999, curatorNote: 'Perfect drape for Indian summers.' },
      { id: 'p3', name: 'Silk Camisole', imageUrl: '', slug: 'silk-camisole', price: 2999, curatorNote: 'Layer under blazers or wear solo.' },
      { id: 'p4', name: 'Structured Tote', imageUrl: '', slug: 'structured-tote', price: 6999, curatorNote: 'Carries everything, looks polished.' },
    ],
    collections: [{ id: 'c1', name: 'Office Essentials', products: [] }],
  },
  '2': {
    creator: {
      id: '2',
      name: 'Rohan Mehta',
      handle: '@rohancodes',
      avatarUrl: '',
      bio: 'Tech meets fashion. Digital creator blending streetwear with contemporary tailoring.',
      followerCount: 189000,
      curatedCount: 31,
      verified: true,
      tags: ['Streetwear', 'Contemporary', 'Digital'],
    },
    products: [
      { id: 'p5', name: 'Oversized Hoodie', imageUrl: '', slug: 'oversized-hoodie', price: 4499, curatorNote: 'Everyday essential with premium weight.' },
      { id: 'p6', name: 'Tech Cargo Pants', imageUrl: '', slug: 'tech-cargo', price: 3499, curatorNote: 'Function meets form — 8 pockets, zero bulk.' },
    ],
    collections: [],
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = creatorsData[id];
    if (!data) {
      return NextResponse.json({ ok: false, error: 'Creator not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load creator' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    // Handle follow action
    if (body.action === 'follow') {
      return NextResponse.json({ ok: true, data: { followed: true } });
    }

    return NextResponse.json({ ok: true, data: { success: true } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Action failed' }, { status: 500 });
  }
}
