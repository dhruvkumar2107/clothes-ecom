const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const banners = await prisma.banner.findMany();
  console.log('All banners:', JSON.stringify(banners, null, 2));
  const now = new Date();
  console.log('Current time:', now.toISOString());
  const active = await prisma.banner.findFirst({
    where: {
      placement: 'home_hero',
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
  });
  console.log('Active banner:', JSON.stringify(active, null, 2));
  const collections = await prisma.collection.findMany({ where: { active: true }, select: { slug: true, heroImage: true } });
  console.log('Collections:', JSON.stringify(collections, null, 2));
  const products = await prisma.product.findMany({ where: { status: 'active' }, take: 2, select: { name: true, images: { take: 1, select: { url: true } } } });
  console.log('Products:', JSON.stringify(products, null, 2));
}
main().finally(() => prisma.$disconnect());
