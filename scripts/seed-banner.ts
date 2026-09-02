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
      imageUrl: '/images/hero-banner.webp',
      mobileImageUrl: '/images/hero-banner-mobile.webp',
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
