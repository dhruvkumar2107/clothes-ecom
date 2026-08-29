import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Upsert the home hero banner
  const banner = await prisma.banner.upsert({
    where: { id: 'home_hero_default' },
    update: {},
    create: {
      id: 'home_hero_default',
      name: 'Homepage Hero — Light as Couture',
      placement: 'home_hero',
      imageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1920&q=80',
      mobileImageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80',
      eyebrow: null,
      headline: 'Light as couture',
      subhead: 'Engineered fabrics. Sculptural silhouettes. Limited drops shipped across India.',
      ctaLabel: 'Shop New Arrivals',
      ctaHref: '/products?sort=newest',
      accentHex: '#c9a96e',
      theme: 'dark',
      sortOrder: 0,
      active: true,
    },
  });

  console.log('Banner created/updated:', banner.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
