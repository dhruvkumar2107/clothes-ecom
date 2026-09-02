/**
 * Migration script: Replace all Unsplash URLs in the database with local paths.
 * Run with: npx tsx scripts/migrate-image-urls.ts
 *
 * This updates ProductImage.url, Collection.heroImage, and Banner.imageUrl
 * from external Unsplash URLs to self-hosted /images/ paths.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Map of Unsplash photo IDs to local paths
const UNSPLASH_TO_LOCAL: Record<string, string> = {
  // Hero/Banner
  'photo-1509631179647-0177331693ae': '/images/hero-banner.jpg',

  // Product images
  'photo-1598033129183-c4f50c736f10': '/images/product-linen-shirt.jpg',
  'photo-1603252109303-2751441dd157': '/images/product-linen-detail.jpg',
  'photo-1602810318383-e386cc2a3ccf': '/images/product-shirt-worn.jpg',
  'photo-1620012253295-c15cc3e65df4': '/images/product-silk-shirt.jpg',
  'photo-1539109136881-3be0616acf4b': '/images/product-wrap-dress.jpg',
  'photo-1515886657613-9f3515b0c78f': '/images/product-dress-back.jpg',
  'photo-1576995853123-5a10305d93c0': '/images/product-merino-wool.jpg',
  'photo-1608256246200-53e635b5b65f': '/images/product-cashmere-scarf.jpg',

  // Collection images
  'photo-1490481651871-ab68de25d43d': '/images/collection-lumen-edit.jpg',
  'photo-1441986300917-64674bd600d8': '/images/collection-new-arrivals.jpg',
  'photo-1523381210434-271e8be1f52b': '/images/collection-essentials.jpg',
  'photo-1539533113208-f6df8cc8b543': '/images/collection-winter.jpg',
  'photo-1469334031218-e382a71b716b': '/images/collection-summer.jpg',
  'photo-1520367445093-50dc08a59d9d': '/images/collection-monsoon.jpg',
};

// Fallback images for any unmatched Unsplash URLs
const FALLBACK_LOCAL = '/images/product-linen-shirt.jpg';

function convertUrl(url: string): string | null {
  if (!url) return null;

  // Already a local path
  if (url.startsWith('/images/')) return null;

  // Extract Unsplash photo ID from URL
  for (const [photoId, localPath] of Object.entries(UNSPLASH_TO_LOCAL)) {
    if (url.includes(photoId)) {
      return localPath;
    }
  }

  // Any other Unsplash URL
  if (url.includes('unsplash.com') || url.includes('images.unsplash.com')) {
    console.log(`  ⚠ Unmatched Unsplash URL: ${url.substring(0, 80)}...`);
    return FALLBACK_LOCAL;
  }

  // Non-Unsplash URL (e.g., uploaded image) — leave as is
  return null;
}

async function migrateProductImages() {
  console.log('\n📦 Migrating ProductImage URLs...');
  const images = await prisma.productImage.findMany();
  let updated = 0;

  for (const img of images) {
    const newUrl = convertUrl(img.url);
    if (newUrl) {
      await prisma.productImage.update({
        where: { id: img.id },
        data: { url: newUrl },
      });
      updated++;
    }
  }

  console.log(`   Updated ${updated} / ${images.length} product images`);
}

async function migrateCollections() {
  console.log('\n🗂️  Migrating Collection heroImage...');
  const collections = await prisma.collection.findMany({
    where: { heroImage: { not: null } },
  });
  let updated = 0;

  for (const col of collections) {
    const newUrl = convertUrl(col.heroImage!);
    if (newUrl) {
      await prisma.collection.update({
        where: { id: col.id },
        data: { heroImage: newUrl },
      });
      updated++;
    }
  }

  console.log(`   Updated ${updated} / ${collections.length} collection hero images`);
}

async function migrateBanners() {
  console.log('\n🖼️  Migrating Banner URLs...');
  const banners = await prisma.banner.findMany();
  let updated = 0;

  for (const banner of banners) {
    let changed = false;
    const data: { imageUrl?: string; mobileImageUrl?: string } = {};

    if (banner.imageUrl) {
      const newUrl = convertUrl(banner.imageUrl);
      if (newUrl) {
        data.imageUrl = newUrl;
        changed = true;
      }
    }

    if (banner.mobileImageUrl) {
      const newUrl = convertUrl(banner.mobileImageUrl);
      if (newUrl) {
        data.mobileImageUrl = newUrl;
        changed = true;
      }
    }

    if (changed) {
      await prisma.banner.update({
        where: { id: banner.id },
        data,
      });
      updated++;
    }
  }

  console.log(`   Updated ${updated} / ${banners.length} banners`);
}

async function main() {
  console.log('🔄 Starting image URL migration...');
  console.log('   Converting Unsplash URLs to self-hosted /images/ paths\n');

  await migrateProductImages();
  await migrateCollections();
  await migrateBanners();

  console.log('\n✅ Migration complete!');
  console.log('   All Unsplash URLs have been replaced with local paths.');

  // Verify
  const remaining = await prisma.productImage.count({
    where: { url: { contains: 'unsplash' } },
  });
  if (remaining > 0) {
    console.log(`\n⚠️  Warning: ${remaining} product images still contain Unsplash URLs`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
