import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // TODO: Fetch from database
    const creators = [
      {
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
      {
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
      {
        id: '3',
        name: 'Priya Nair',
        handle: '@priyawears',
        avatarUrl: '',
        bio: 'Celebrity stylist. Red carpet to real life — making luxury accessible.',
        followerCount: 512000,
        curatedCount: 67,
        verified: true,
        tags: ['Luxury', 'Evening', 'Celebrity'],
      },
      {
        id: '4',
        name: 'Arjun Patel',
        handle: '@arjunfit',
        avatarUrl: '',
        bio: 'Fitness and fashion crossover. Performance wear that looks as good as it feels.',
        followerCount: 156000,
        curatedCount: 23,
        verified: false,
        tags: ['Athleisure', 'Performance', 'Minimal'],
      },
    ];

    return NextResponse.json({ ok: true, data: creators });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load creators' }, { status: 500 });
  }
}
