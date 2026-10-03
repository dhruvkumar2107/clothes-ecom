import { access } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TOTAL_PER_DEPARTMENT = 50;
const CATALOG_COLLECTION = 'catalog-edit-2026';

type CategorySeed = {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  hsnCode: string;
  priceFrom: number;
  fabrics: string[];
  fits: string[];
  occasions: string[];
  styles: string[];
  gender: 'women' | 'men' | 'unisex';
  sizes: string[];
  images: [string, string];
};

type CatalogItem = {
  slug: string;
  name: string;
  categorySlug: string;
  gender: CategorySeed['gender'];
  hsnCode: string;
  basePrice: number;
  compareAtPrice: number;
  costPrice: number;
  fabric: string;
  occasion: string;
  fit: string;
  sizes: string[];
  colors: { name: string; hex: string }[];
  images: { url: string; alt: string; kind: string; colorKey: string | null; sortOrder: number }[];
  tags: string[];
  featured: boolean;
};

const refinements = [
  'Atelier',
  'Signature',
  'Sculpted',
  'Everyday',
  'Modern',
  'Heritage',
  'Refined',
  'Essential',
  'Relaxed',
  'Studio',
] as const;

const palettes = [
  { name: 'Ivory', hex: '#F2EEE5' },
  { name: 'Midnight', hex: '#202936' },
  { name: 'Sage', hex: '#87927A' },
  { name: 'Terracotta', hex: '#B8755B' },
  { name: 'Oat', hex: '#C8B99F' },
  { name: 'Ink', hex: '#252525' },
  { name: 'Sky', hex: '#9CB7C5' },
  { name: 'Olive', hex: '#727357' },
] as const;

const categories: CategorySeed[] = [
  {
    slug: 'women-tops', name: 'Tops & Blouses', description: 'Elevated tops and blouses',
    sortOrder: 1, hsnCode: '6206', priceFrom: 249000,
    fabrics: ['European linen', 'organic cotton poplin', 'silk-cotton voile', 'TENCEL™ twill'],
    fits: ['relaxed', 'regular', 'tailored'], occasions: ['casual', 'workwear', 'evening'],
    styles: ['Linen Button Blouse', 'Silk Cami Top', 'Cotton Poplin Shirt', 'Draped Wrap Top', 'Ribbed Shell Top'],
    gender: 'women', sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: ['/images/product-silk-shirt.webp', '/images/product-shirt-worn.webp'],
  },
  {
    slug: 'women-dresses', name: 'Dresses', description: 'Modern dresses for every occasion',
    sortOrder: 2, hsnCode: '6204', priceFrom: 429000,
    fabrics: ['organic cotton poplin', 'European linen', 'silk charmeuse', 'viscose crepe'],
    fits: ['regular', 'relaxed', 'sculpted'], occasions: ['casual', 'workwear', 'evening'],
    styles: ['Wrap Midi Dress', 'Linen Column Dress', 'Poplin Shirt Dress', 'Bias-Cut Slip Dress', 'Tiered Day Dress'],
    gender: 'women', sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: ['/images/product-wrap-dress.webp', '/images/product-dress-back.webp'],
  },
  {
    slug: 'women-bottoms', name: 'Bottoms', description: 'Considered trousers, skirts and shorts',
    sortOrder: 3, hsnCode: '6204', priceFrom: 329000,
    fabrics: ['cotton-linen twill', 'TENCEL™ denim', 'organic cotton sateen', 'linen suiting'],
    fits: ['wide-leg', 'straight', 'relaxed'], occasions: ['casual', 'workwear', 'resort'],
    styles: ['Wide-Leg Trouser', 'Tailored Straight Pant', 'Linen Pull-On Short', 'Pleated Midi Skirt', 'Relaxed Utility Pant'],
    gender: 'women', sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: ['/images/product-linen-detail.webp', '/images/product-shirt-worn.webp'],
  },
  {
    slug: 'women-outerwear', name: 'Outerwear', description: 'Light layers and refined outerwear',
    sortOrder: 4, hsnCode: '6202', priceFrom: 649000,
    fabrics: ['cotton gabardine', 'linen canvas', 'recycled wool blend', 'water-resistant cotton'],
    fits: ['relaxed', 'regular', 'oversized'], occasions: ['casual', 'workwear', 'travel'],
    styles: ['Belted Trench Coat', 'Cropped Utility Jacket', 'Linen Blazer', 'Quilted Light Jacket', 'Relaxed Overshirt'],
    gender: 'women', sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: ['/images/product-merino-wool.webp', '/images/product-linen-detail.webp'],
  },
  {
    slug: 'women-knitwear', name: 'Knitwear', description: 'Soft layers in considered natural fibres',
    sortOrder: 5, hsnCode: '6110', priceFrom: 449000,
    fabrics: ['extra-fine merino wool', 'organic cotton rib', 'cashmere-wool blend', 'responsible viscose'],
    fits: ['relaxed', 'regular', 'slim'], occasions: ['casual', 'workwear', 'travel'],
    styles: ['Merino Crew Sweater', 'Ribbed Turtleneck', 'Cashmere-Blend Cardigan', 'Cotton Knit Polo', 'Soft Knit Vest'],
    gender: 'women', sizes: ['XS', 'S', 'M', 'L', 'XL'],
    images: ['/images/product-merino-wool.webp', '/images/product-cashmere-scarf.webp'],
  },
  {
    slug: 'men-shirts', name: 'Shirts', description: 'Refined shirts for work and weekends',
    sortOrder: 1, hsnCode: '6205', priceFrom: 299000,
    fabrics: ['European linen', 'organic cotton oxford', 'cotton poplin', 'silk-cotton blend'],
    fits: ['regular', 'relaxed', 'slim'], occasions: ['casual', 'workwear', 'formal'],
    styles: ['Linen Camp-Collar Shirt', 'Oxford Button-Down', 'Poplin Dress Shirt', 'Grandad-Collar Shirt', 'Textured Overshirt'],
    gender: 'men', sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    images: ['/images/product-linen-shirt.webp', '/images/product-silk-shirt.webp'],
  },
  {
    slug: 'men-trousers', name: 'Trousers', description: 'Modern trousers with considered tailoring',
    sortOrder: 2, hsnCode: '6203', priceFrom: 379000,
    fabrics: ['brushed cotton twill', 'linen suiting', 'TENCEL™ denim', 'stretch cotton canvas'],
    fits: ['straight', 'tapered', 'relaxed'], occasions: ['casual', 'workwear', 'travel'],
    styles: ['Pleated Chino Trouser', 'Relaxed Linen Pant', 'Straight-Leg Denim', 'Tapered Travel Trouser', 'Cotton Drawstring Pant'],
    gender: 'men', sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    images: ['/images/product-linen-detail.webp', '/images/product-shirt-worn.webp'],
  },
  {
    slug: 'men-outerwear', name: 'Outerwear', description: 'Purposeful jackets and transitional layers',
    sortOrder: 3, hsnCode: '6201', priceFrom: 649000,
    fabrics: ['cotton gabardine', 'recycled nylon shell', 'recycled wool blend', 'waxed cotton canvas'],
    fits: ['regular', 'relaxed', 'oversized'], occasions: ['casual', 'workwear', 'travel'],
    styles: ['Cotton Field Jacket', 'Classic Trench Coat', 'Light Quilted Jacket', 'Wool-Blend Overshirt', 'Technical Rain Shell'],
    gender: 'men', sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    images: ['/images/product-linen-detail.webp', '/images/product-merino-wool.webp'],
  },
  {
    slug: 'men-knitwear', name: 'Knitwear', description: 'Natural-fibre knitwear with lasting comfort',
    sortOrder: 4, hsnCode: '6110', priceFrom: 429000,
    fabrics: ['extra-fine merino wool', 'organic cotton knit', 'lambswool blend', 'cashmere-wool blend'],
    fits: ['regular', 'relaxed', 'slim'], occasions: ['casual', 'workwear', 'travel'],
    styles: ['Merino Crew-Neck Sweater', 'Cotton Knit Polo', 'Ribbed Half-Zip', 'Lambswool Cardigan', 'Fine-Gauge Turtleneck'],
    gender: 'men', sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    images: ['/images/product-merino-wool.webp', '/images/product-cashmere-scarf.webp'],
  },
  {
    slug: 'unisex-knitwear', name: 'Knitwear', description: 'Easy, inclusive knitwear in natural fibres',
    sortOrder: 1, hsnCode: '6110', priceFrom: 449000,
    fabrics: ['extra-fine merino wool', 'organic cotton rib', 'cashmere-wool blend', 'responsible viscose'],
    fits: ['relaxed', 'oversized', 'regular'], occasions: ['casual', 'travel', 'layering'],
    styles: ['Unisex Merino Crew', 'Relaxed Rib Sweater', 'Soft Cotton Cardigan', 'Oversized Knit Vest', 'Cashmere-Blend Pullover'],
    gender: 'unisex', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    images: ['/images/product-merino-wool.webp', '/images/product-cashmere-scarf.webp'],
  },
  {
    slug: 'unisex-accessories', name: 'Accessories', description: 'Finishing pieces made for everyday use',
    sortOrder: 2, hsnCode: '6214', priceFrom: 149000,
    fabrics: ['cashmere-wool blend', 'organic cotton canvas', 'vegetable-tanned leather', 'recycled wool'],
    fits: ['one size'], occasions: ['casual', 'travel', 'gifting'],
    styles: ['Cashmere-Blend Scarf', 'Merino Rib Beanie', 'Organic Canvas Tote', 'Leather Everyday Belt', 'Woven Travel Pouch'],
    gender: 'unisex', sizes: ['One Size'],
    images: ['/images/product-cashmere-scarf.webp', '/images/product-linen-detail.webp'],
  },
  {
    slug: 'unisex-outerwear', name: 'Outerwear', description: 'Versatile layers designed for everyone',
    sortOrder: 3, hsnCode: '6201', priceFrom: 599000,
    fabrics: ['cotton gabardine', 'recycled nylon shell', 'linen canvas', 'recycled wool blend'],
    fits: ['regular', 'relaxed', 'oversized'], occasions: ['casual', 'travel', 'layering'],
    styles: ['Unisex Utility Overshirt', 'Light Quilted Vest', 'Relaxed Field Jacket', 'Weather-Ready Shell', 'Linen Workwear Jacket'],
    gender: 'unisex', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    images: ['/images/product-linen-detail.webp', '/images/product-merino-wool.webp'],
  },
];

const editions = [
  'Studio', 'Signature', 'Essential', 'Modern', 'Heritage',
  'Refined', 'Everyday', 'Atelier', 'Considered', 'Limited',
];

const tagSeeds = [
  { slug: 'sustainable', name: 'Sustainable' },
  { slug: 'minimalist', name: 'Minimalist' },
  { slug: 'tailored', name: 'Tailored' },
  { slug: 'casual', name: 'Casual' },
  { slug: 'workwear', name: 'Workwear' },
  { slug: 'layering', name: 'Layering' },
  { slug: 'natural-fibres', name: 'Natural Fibres' },
];

function makeCatalog(): CatalogItem[] {
  const result: CatalogItem[] = [];

  for (const department of ['women', 'men', 'unisex'] as const) {
    const departmentCategories = categories.filter((category) => category.gender === department);
    const perCategory = Math.floor(TOTAL_PER_DEPARTMENT / departmentCategories.length);
    const remainder = TOTAL_PER_DEPARTMENT % departmentCategories.length;
    let departmentIndex = 0;

    departmentCategories.forEach((category, categoryIndex) => {
      const count = perCategory + (categoryIndex < remainder ? 1 : 0);

      for (let index = 0; index < count; index++) {
        const style = category.styles[index % category.styles.length];
        const edition = editions[Math.floor(index / category.styles.length) % editions.length];
        const name = `${edition} ${style}`;
        const slug = `${category.slug}-${String(index + 1).padStart(2, '0')}-${edition.toLowerCase()}`;
        const fabric = category.fabrics[(index + categoryIndex) % category.fabrics.length];
        const fit = category.fits[index % category.fits.length];
        const occasion = category.occasions[(index + categoryIndex) % category.occasions.length];
        const priceStep = (index % 5) * 25000;
        const basePrice = category.priceFrom + priceStep;
        const images = category.images.map((url, imageIndex) => ({
          url,
          alt: `${name} — ${imageIndex === 0 ? 'front view' : 'fabric detail'}`,
          kind: 'gallery',
          colorKey: null,
          sortOrder: imageIndex + 1,
        }));
        const colors = [0, 1, 2].map((colorIndex) =>
          palettes[(departmentIndex + index + colorIndex * 2) % palettes.length],
        );

        result.push({
          slug,
          name,
          categorySlug: category.slug,
          gender: department,
          hsnCode: category.hsnCode,
          basePrice,
          compareAtPrice: Math.round(basePrice * 1.25),
          costPrice: Math.round(basePrice * 0.42),
          fabric,
          occasion,
          fit,
          sizes: category.sizes,
          colors: [...new Map(colors.map((color) => [color.name, color])).values()],
          images,
          tags: ['sustainable', 'minimalist', 'natural-fibres', occasion === 'workwear' ? 'workwear' : 'casual'],
          featured: index % 10 === 0,
        });

        departmentIndex++;
      }
    });
  }

  return result;
}

function createVariants(product: CatalogItem) {
  return product.colors.flatMap((color, colorIndex) =>
    product.sizes.map((size, sizeIndex) => {
      const stock = 8 + ((colorIndex * 7 + sizeIndex * 5 + product.slug.length) % 18);
      return {
        sku: `${product.slug}-${color.name}-${size}`.toUpperCase().replace(/[^A-Z0-9-]/g, '-'),
        size,
        color: color.name,
        colorHex: color.hex,
        priceDelta: 0,
        stock,
        weightGrams: product.categorySlug.includes('accessories') ? 180 : 350 + sizeIndex * 15,
        sortOrder: colorIndex * product.sizes.length + sizeIndex,
      };
    }),
  );
}

async function verifyImages() {
  const imagePaths = [...new Set(categories.flatMap((category) => category.images))];
  await Promise.all(imagePaths.map((imagePath) =>
    access(path.join(process.cwd(), 'public', imagePath.replace(/^\//, ''))),
  ));
}

async function seedCatalog() {
  await verifyImages();
  const products = makeCatalog();
  const counts = Object.groupBy(products, (product) => product.gender);
  if (products.length !== TOTAL_PER_DEPARTMENT * 3) {
    throw new Error(`Expected ${TOTAL_PER_DEPARTMENT * 3} products, generated ${products.length}`);
  }
  console.log(`Catalog plan: ${products.length} products`);
  for (const department of ['women', 'men', 'unisex'] as const) {
    const count = counts[department]?.length ?? 0;
    if (count !== TOTAL_PER_DEPARTMENT) {
      throw new Error(`Expected ${TOTAL_PER_DEPARTMENT} ${department} products, generated ${count}`);
    }
    console.log(`  ${department}: ${count}`);
  }

  if (process.argv.includes('--dry-run')) return;

  await prisma.$transaction(async (tx) => {
    const roots = new Map<string, { id: string }>();
    for (const [slug, name, description, sortOrder] of [
      ['women', 'Women', 'Elevated womenswear', 1],
      ['men', 'Men', 'Refined menswear', 2],
      ['unisex', 'Unisex', 'Gender-inclusive pieces', 3],
    ] as const) {
      roots.set(slug, await tx.category.upsert({
        where: { slug },
        update: { active: true },
        create: { slug, name, description, sortOrder, active: true },
        select: { id: true },
      }));
    }

    const categoryIds = new Map<string, string>();
    for (const category of categories) {
      const parent = roots.get(category.gender);
      if (!parent) throw new Error(`Missing parent category for ${category.slug}`);
      const saved = await tx.category.upsert({
        where: { slug: category.slug },
        update: { active: true, parentId: parent.id },
        create: {
          slug: category.slug,
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          active: true,
          parentId: parent.id,
        },
        select: { id: true },
      });
      categoryIds.set(category.slug, saved.id);
    }

    for (const tag of tagSeeds) {
      await tx.tag.upsert({
        where: { slug: tag.slug },
        update: {},
        create: { ...tag, kind: 'style' },
      });
    }

    const collection = await tx.collection.upsert({
      where: { slug: CATALOG_COLLECTION },
      update: { active: true },
      create: {
        slug: CATALOG_COLLECTION,
        name: 'The Essential Wardrobe',
        kind: 'curated',
        tagline: 'Considered pieces for everyday dressing',
        description: 'An edit of versatile silhouettes in premium, comfortable fabrics.',
        heroImage: '/images/collection-essentials.jpg',
        featured: true,
        sortOrder: 20,
        active: true,
      },
      select: { id: true },
    });

    for (const product of products) {
      const categoryId = categoryIds.get(product.categorySlug);
      if (!categoryId) throw new Error(`Missing category record for ${product.categorySlug}`);

      await tx.product.upsert({
        where: { slug: product.slug },
        update: {},
        create: {
          slug: product.slug,
          name: product.name,
          subtitle: `${product.fabric} in a ${product.fit} silhouette`,
          description: `${product.name} is thoughtfully made from ${product.fabric}. Designed with ${product.fit} proportions and an easy ${product.occasion} wardrobe in mind, it pairs lasting comfort with considered details.`,
          story: `A versatile ${product.gender} wardrobe piece, designed to be worn often and kept for seasons.`,
          careJson: '["Cold gentle wash","Wash with similar colours","Dry in shade","Warm iron if needed"]',
          categoryId,
          basePrice: product.basePrice,
          compareAtPrice: product.compareAtPrice,
          costPrice: product.costPrice,
          fabric: product.fabric,
          occasion: product.occasion,
          fit: product.fit,
          gender: product.gender,
          hsnCode: product.hsnCode,
          gstRate: 5,
          status: 'active',
          featured: product.featured,
          publishedAt: new Date(),
          seoTitle: `${product.name} | LUMEN&CO`,
          seoDescription: `${product.name} in ${product.fabric}. Explore considered ${product.gender} fashion at LUMEN&CO.`,
          images: { create: product.images },
          variants: { create: createVariants(product) },
          tags: { create: product.tags.map((slug) => ({ tag: { connect: { slug } } })) },
          collections: { create: [{ collectionId: collection.id }] },
        },
      });
    }
  }, { maxWait: 10_000, timeout: 120_000 });

  console.log(`Catalog seed complete. Upserted ${products.length} products (safe to run again).`);
}

seedCatalog()
  .catch((error: unknown) => {
    console.error('Catalog seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
