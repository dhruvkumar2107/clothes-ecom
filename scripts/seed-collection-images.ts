import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Add hero images to collections that don't have one
  const collections = await prisma.collection.findMany({
    where: { active: true, heroImage: null },
    take: 5,
  });

  const heroImages: Record<string, string> = {
    'new-arrivals': '/images/collection-new-arrivals.webp',
    'bestsellers': '/images/collection-lumen-edit.webp',
    'essentials': '/images/collection-essentials.webp',
    'editorial': '/images/product-dress-back.webp',
    'winter': '/images/collection-winter.webp',
    'summer': '/images/collection-summer.webp',
    'monsoon': '/images/collection-monsoon.webp',
  };

  const defaultImages = [
    '/images/collection-lumen-edit.webp',
    '/images/collection-new-arrivals.webp',
    '/images/collection-essentials.webp',
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
