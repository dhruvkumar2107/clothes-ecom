import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Add hero images to collections that don't have one
  const collections = await prisma.collection.findMany({
    where: { active: true, heroImage: null },
    take: 5,
  });

  const heroImages: Record<string, string> = {
    'new-arrivals': 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
    'bestsellers': 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80',
    'essentials': 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80',
    'editorial': 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80',
    'winter': 'https://images.unsplash.com/photo-1539533113208-f6df8cc8b543?auto=format&fit=crop&w=1200&q=80',
    'summer': 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1200&q=80',
    'monsoon': 'https://images.unsplash.com/photo-1520367445093-50dc08a59d9d?auto=format&fit=crop&w=1200&q=80',
  };

  const defaultImages = [
    'https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1558171813-4c088753af8f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80',
  ];

  let idx = 0;
  for (const col of collections) {
    const imageUrl = heroImages[col.slug] || defaultImages[idx % defaultImages.length];
    await prisma.collection.update({
      where: { id: col.id },
      data: { heroImage: imageUrl },
    });
    console.log(`Updated collection "${col.name}" with hero image`);
    idx++;
  }

  if (collections.length === 0) {
    console.log('No collections without hero images found');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
