import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

const UNAMBIGUOUS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomCode(length = 8): string {
  const bytes = new Uint8Array(length * 2);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; out.length < length && i < bytes.length; i++) {
    const idx = bytes[i] % UNAMBIGUOUS.length;
    if (bytes[i] < 248) out += UNAMBIGUOUS[idx];
  }
  return out.length === length ? out : randomCode(length);
}
async function generateReferralCode(name: string, client: PrismaClient = prisma): Promise<string> {
  const stem = name.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = stem.length >= 3 ? `${stem}${randomCode(4)}` : randomCode(8);
    const clash = await client.user.findUnique({ where: { referralCode: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `${randomCode(10)}`;
}

// Compact variant generator: sizes x colors matrix
function mkVariants(sizes: string[], colors: { name: string; hex: string }[], baseStock = 20, weight = 300) {
  const v: { size: string; color: string; colorHex: string; priceDelta: number; stock: number; weightGrams: number }[] = [];
  for (const c of colors) {
    for (const s of sizes) {
      const stockJitter = Math.floor(Math.random() * 16) - 4;
      v.push({ size: s, color: c.name, colorHex: c.hex, priceDelta: 0, stock: Math.max(4, baseStock + stockJitter), weightGrams: weight + sizes.indexOf(s) * 10 });
    }
  }
  return v;
}

type ProductDef = {
  slug: string; name: string; subtitle: string; description: string;
  basePrice: number; compareAtPrice: number; fabric: string; occasion: string;
  fit: string; gender: string; hsnCode: string; categoryId: string;
  images: { url: string; alt: string; kind: string; colorKey: string; sortOrder: number }[];
  sizes: string[]; colors: { name: string; hex: string }[];
  tags: string[]; collections: string[]; featured?: boolean;
};

const W = (id: string) => id; // just pass through category id

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.$transaction([
    prisma.webhookEvent.deleteMany(), prisma.settlement.deleteMany(), prisma.emiPlan.deleteMany(),
    prisma.savedPaymentMethod.deleteMany(), prisma.payoutAttempt.deleteMany(), prisma.withdrawalRequest.deleteMany(),
    prisma.bankVerification.deleteMany(), prisma.bankAccount.deleteMany(), prisma.walletTransaction.deleteMany(),
    prisma.wallet.deleteMany(), prisma.referralFraudFlag.deleteMany(), prisma.referralCommission.deleteMany(),
    prisma.referral.deleteMany(), prisma.referralTier.deleteMany(), prisma.referralRule.deleteMany(),
    prisma.couponRedemption.deleteMany(), prisma.coupon.deleteMany(), prisma.loyaltyTransaction.deleteMany(),
    prisma.loyaltyTierDef.deleteMany(), prisma.answer.deleteMany(), prisma.question.deleteMany(),
    prisma.reviewMedia.deleteMany(), prisma.review.deleteMany(), prisma.wishlistItem.deleteMany(),
    prisma.inventoryLedger.deleteMany(), prisma.cartItem.deleteMany(), prisma.cart.deleteMany(),
    prisma.abandonedCart.deleteMany(), prisma.shipmentEvent.deleteMany(), prisma.shipment.deleteMany(),
    prisma.invoice.deleteMany(), prisma.orderEvent.deleteMany(), prisma.orderItem.deleteMany(),
    prisma.returnItem.deleteMany(), prisma.return.deleteMany(), prisma.refund.deleteMany(),
    prisma.paymentAttempt.deleteMany(), prisma.paymentIntent.deleteMany(), prisma.order.deleteMany(),
    prisma.productTag.deleteMany(), prisma.productCollection.deleteMany(), prisma.tag.deleteMany(),
    prisma.collection.deleteMany(), prisma.sizeGuide.deleteMany(), prisma.productImage.deleteMany(),
    prisma.productVariant.deleteMany(), prisma.product.deleteMany(), prisma.category.deleteMany(),
    prisma.address.deleteMany(), prisma.pincode.deleteMany(), prisma.otpChallenge.deleteMany(),
    prisma.passwordReset.deleteMany(), prisma.session.deleteMany(), prisma.account.deleteMany(),
    prisma.user.deleteMany(), prisma.staffSession.deleteMany(), prisma.staffUser.deleteMany(),
    prisma.staffRole.deleteMany(), prisma.auditLog.deleteMany(), prisma.banner.deleteMany(),
    prisma.setting.deleteMany(),
  ]);

  // ── Settings ────────────────────────────────────────────────
  await prisma.setting.createMany({ data: [
    { key: 'store.name', value: 'LUMEN&CO', valueType: 'string', group: 'general', label: 'Store Name' },
    { key: 'store.tagline', value: 'Light as couture', valueType: 'string', group: 'general', label: 'Store Tagline' },
    { key: 'store.defaultLocale', value: 'en', valueType: 'string', group: 'general', label: 'Default Locale' },
    { key: 'store.defaultCurrency', value: 'INR', valueType: 'string', group: 'general', label: 'Default Currency' },
    { key: 'theme.accentPrimary', value: '#B08D57', valueType: 'string', group: 'theme', label: 'Primary Accent Color' },
    { key: 'theme.accentSecondary', value: '#7C8B7A', valueType: 'string', group: 'theme', label: 'Secondary Accent Color' },
    { key: 'theme.accentTertiary', value: '#8C5F56', valueType: 'string', group: 'theme', label: 'Tertiary Accent Color' },
    { key: 'theme.enableGrain', value: 'true', valueType: 'boolean', group: 'theme', label: 'Enable Film Grain' },
    { key: 'checkout.returnWindowDays', value: '14', valueType: 'number', group: 'general', label: 'Return Window (Days)' },
    { key: 'checkout.walletMaxPercent', value: '50', valueType: 'number', group: 'payments', label: 'Max Wallet Usage %' },
    { key: 'wallet.enabled', value: 'true', valueType: 'boolean', group: 'payments', label: 'Enable Wallet' },
    { key: 'loyalty.enabled', value: 'true', valueType: 'boolean', group: 'payments', label: 'Enable Loyalty' },
    { key: 'loyalty.pointValue', value: '100', valueType: 'number', group: 'payments', label: 'Point Value (Paise)' },
    { key: 'loyalty.pointsPerHundred', value: '100', valueType: 'number', group: 'payments', label: 'Points per 100' },
  ] });

  // ── Banner ──────────────────────────────────────────────────
  await prisma.banner.upsert({ where: { id: 'home_hero_default' }, update: {}, create: {
    id: 'home_hero_default', name: 'Homepage Hero', placement: 'home_hero',
    imageUrl: '/images/hero-banner.webp', mobileImageUrl: '/images/hero-banner-mobile.webp',
    headline: 'Light as couture', subhead: 'Engineered fabrics. Sculptural silhouettes.',
    ctaLabel: 'Shop New Arrivals', ctaHref: '/products?sort=newest',
    accentHex: '#c9a96e', theme: 'dark', sortOrder: 0, active: true,
  }});

  // ── Loyalty Tiers ───────────────────────────────────────────
  await prisma.loyaltyTierDef.createMany({ data: [
    { slug: 'bronze', name: 'Bronze', minSpend: 0, pointsMultiplier: 1, perksJson: '["Welcome offer"]', colorHex: '#CD7F32', sortOrder: 1 },
    { slug: 'silver', name: 'Silver', minSpend: 500000, pointsMultiplier: 1.25, perksJson: '["Free shipping"]', colorHex: '#C0C0C0', sortOrder: 2 },
    { slug: 'gold', name: 'Gold', minSpend: 2000000, pointsMultiplier: 1.5, perksJson: '["Free express shipping"]', colorHex: '#FFD700', sortOrder: 3, freeShipping: true, earlyAccessHours: 24 },
  ] });

  // ── Staff ───────────────────────────────────────────────────
  const adminRole = await prisma.staffRole.create({ data: { name: 'Administrator', slug: 'admin', description: 'Full system access', permissionsCsv: 'orders.read,orders.write,products.read,products.write,customers.read,customers.write,settings.read,settings.write,payouts.approve,analytics.read', isSystem: true } });
  await prisma.staffRole.create({ data: { name: 'Support Agent', slug: 'support', description: 'Customer support', permissionsCsv: 'orders.read,orders.write,customers.read,refunds.process', isSystem: false } });
  await prisma.staffUser.create({ data: { email: 'admin@lumenandco.example', passwordHash: await hashPassword('Admin@12345'), name: 'Admin User', roleId: adminRole.id, status: 'active' } });

  // ── Categories ──────────────────────────────────────────────
  const women = await prisma.category.create({ data: { slug: 'women', name: 'Women', description: 'Elevated womenswear', sortOrder: 1, active: true } });
  const men = await prisma.category.create({ data: { slug: 'men', name: 'Men', description: 'Refined menswear', sortOrder: 2, active: true } });
  const unisex = await prisma.category.create({ data: { slug: 'unisex', name: 'Unisex', description: 'Gender-fluid pieces', sortOrder: 3, active: true } });

  const womenTops = await prisma.category.create({ data: { slug: 'women-tops', name: 'Tops & Blouses', parentId: women.id, sortOrder: 1, active: true } });
  const womenDresses = await prisma.category.create({ data: { slug: 'women-dresses', name: 'Dresses', parentId: women.id, sortOrder: 2, active: true } });
  const womenBottoms = await prisma.category.create({ data: { slug: 'women-bottoms', name: 'Bottoms', parentId: women.id, sortOrder: 3, active: true } });
  const womenOuterwear = await prisma.category.create({ data: { slug: 'women-outerwear', name: 'Outerwear', parentId: women.id, sortOrder: 4, active: true } });
  const womenKnitwear = await prisma.category.create({ data: { slug: 'women-knitwear', name: 'Knitwear', parentId: women.id, sortOrder: 5, active: true } });
  const menShirts = await prisma.category.create({ data: { slug: 'men-shirts', name: 'Shirts', parentId: men.id, sortOrder: 1, active: true } });
  const menTrousers = await prisma.category.create({ data: { slug: 'men-trousers', name: 'Trousers', parentId: men.id, sortOrder: 2, active: true } });
  const menOuterwear = await prisma.category.create({ data: { slug: 'men-outerwear', name: 'Outerwear', parentId: men.id, sortOrder: 3, active: true } });
  const menKnitwear = await prisma.category.create({ data: { slug: 'men-knitwear', name: 'Knitwear', parentId: men.id, sortOrder: 4, active: true } });
  const unisexKnitwear = await prisma.category.create({ data: { slug: 'unisex-knitwear', name: 'Knitwear', parentId: unisex.id, sortOrder: 1, active: true } });
  const unisexAccessories = await prisma.category.create({ data: { slug: 'unisex-accessories', name: 'Accessories', parentId: unisex.id, sortOrder: 2, active: true } });
  const unisexOuterwear = await prisma.category.create({ data: { slug: 'unisex-outerwear', name: 'Outerwear', parentId: unisex.id, sortOrder: 3, active: true } });

  // ── Collections ─────────────────────────────────────────────
  const lumenEdit = await prisma.collection.create({ data: { slug: 'the-lumen-edit', name: 'The Lumen Edit', kind: 'seasonal', tagline: 'Weightless fabrics. Architectural forms.', description: 'Our most essential pieces.', heroImage: '/images/collection-lumen-edit.webp', accentHex: '#B08D57', featured: true, sortOrder: 1, active: true } });
  const newArrivals = await prisma.collection.create({ data: { slug: 'new-arrivals', name: 'New Arrivals', kind: 'drop', tagline: 'Just landed', description: 'Latest drops.', featured: false, sortOrder: 2, active: true } });
  const summerEssentials = await prisma.collection.create({ data: { slug: 'summer-essentials', name: 'Summer Essentials', kind: 'seasonal', tagline: 'Breathe through the heat', description: 'Lightweight summer pieces.', heroImage: '/images/collection-summer.jpg', featured: true, sortOrder: 3, active: true } });
  const workwear = await prisma.collection.create({ data: { slug: 'workwear-edit', name: 'Workwear Edit', kind: 'curated', tagline: 'Dress with intention', description: 'Desk to dinner.', heroImage: '/images/collection-essentials.jpg', featured: false, sortOrder: 4, active: true } });
  const winterWarmers = await prisma.collection.create({ data: { slug: 'winter-warmers', name: 'Winter Warmers', kind: 'seasonal', tagline: 'Layer with luxury', description: 'Cashmere, merino, wool.', heroImage: '/images/collection-winter.webp', featured: true, sortOrder: 5, active: true } });
  const monsoonReady = await prisma.collection.create({ data: { slug: 'monsoon-ready', name: 'Monsoon Ready', kind: 'seasonal', tagline: 'Stay sharp in the rain', description: 'Quick-dry and water-resistant.', heroImage: '/images/collection-monsoon.webp', featured: false, sortOrder: 6, active: true } });

  // ── Tags ────────────────────────────────────────────────────
  const tags = ['linen','cotton','silk','wool','cashmere','denim','tencel','sustainable','minimalist','statement','workwear','evening','casual','formal','layering','oversized','tailored','relaxed'];
  for (const t of tags) await prisma.tag.upsert({ where: { slug: t }, update: {}, create: { slug: t, name: t.charAt(0).toUpperCase() + t.slice(1), kind: ['linen','cotton','silk','wool','cashmere','denim','tencel'].includes(t) ? 'fabric' : 'style' } });

  // ── Size Guides ─────────────────────────────────────────────
  await prisma.sizeGuide.createMany({ data: [
    { name: "Women's Tops & Dresses", categoryId: women.id, unit: 'cm', columnsJson: '["Size","Bust","Waist","Hip"]', rowsJson: '[["XS","82","64","90"],["S","86","68","94"],["M","90","72","98"],["L","96","78","104"],["XL","102","84","110"]]', notes: 'Measure over undergarments.' },
    { name: "Men's Shirts", categoryId: men.id, unit: 'cm', columnsJson: '["Size","Chest","Waist","Neck"]', rowsJson: '[["S","92","82","38"],["M","98","88","39"],["L","104","94","41"],["XL","110","100","42"],["XXL","116","106","43"]]', notes: 'Chest at fullest part.' },
  ] });

  // ── Pincodes ────────────────────────────────────────────────
  for (const pc of [
    { pincode: '110001', city: 'New Delhi', state: 'Delhi', stateCode: '07', zone: 'metro', deliveryDays: 2, expressAvailable: true },
    { pincode: '400001', city: 'Mumbai', state: 'Maharashtra', stateCode: '27', zone: 'metro', deliveryDays: 2, expressAvailable: true },
    { pincode: '560001', city: 'Bangalore', state: 'Karnataka', stateCode: '29', zone: 'metro', deliveryDays: 2, expressAvailable: true },
    { pincode: '600001', city: 'Chennai', state: 'Tamil Nadu', stateCode: '33', zone: 'metro', deliveryDays: 3, expressAvailable: true },
    { pincode: '500001', city: 'Hyderabad', state: 'Telangana', stateCode: '36', zone: 'metro', deliveryDays: 3, expressAvailable: true },
    { pincode: '700001', city: 'Kolkata', state: 'West Bengal', stateCode: '19', zone: 'metro', deliveryDays: 3, expressAvailable: true },
  ]) await prisma.pincode.create({ data: { ...pc, codAvailable: true, codLimit: 500000, returnAvailable: true, prepaidAvailable: true, active: true } });

  // ── Referral Rules ──────────────────────────────────────────
  const referralRule = await prisma.referralRule.create({ data: { name: 'Standard Referral', active: true, kind: 'flat', value: 20000, minOrderValue: 100000, firstOrderOnly: true, holdDays: 14, refereeCouponCode: 'WELCOME200', priority: 10 } });
  await prisma.referralTier.createMany({ data: [
    { ruleId: referralRule.id, name: 'Bronze', minConversions: 5, bonusKind: 'percent', bonusValue: 10, badgeHex: '#CD7F32', sortOrder: 1 },
    { ruleId: referralRule.id, name: 'Silver', minConversions: 15, bonusKind: 'percent', bonusValue: 20, badgeHex: '#C0C0C0', sortOrder: 2 },
    { ruleId: referralRule.id, name: 'Gold', minConversions: 50, bonusKind: 'percent', bonusValue: 30, badgeHex: '#FFD700', sortOrder: 3 },
  ] });

  // ── Coupons ─────────────────────────────────────────────────
  await prisma.coupon.createMany({ data: [
    { code: 'WELCOME200', name: 'Welcome 200 Off', kind: 'flat', value: 20000, minCartValue: 100000, firstOrderOnly: true, active: true, isReferralWelcome: true },
    { code: 'WELCOME10', name: 'Welcome 10% Off', kind: 'percent', value: 10, maxDiscount: 100000, minCartValue: 50000, firstOrderOnly: true, active: true },
    { code: 'FREESHIP', name: 'Free Shipping', kind: 'free_shipping', value: 0, active: true },
    { code: 'SAVE15', name: 'Save 15%', kind: 'percent', value: 15, maxDiscount: 200000, minCartValue: 200000, active: true },
    { code: 'SUMMER25', name: 'Summer Sale 25%', kind: 'percent', value: 25, maxDiscount: 500000, minCartValue: 300000, active: true },
  ] });

  // ── EMI Plans ───────────────────────────────────────────────
  await prisma.emiPlan.createMany({ data: [
    { bank: 'HDFC Bank', bankLogo: '/images/banks/hdfc.png', tenureMonths: 3, interestRate: 0, minAmount: 500000, noCostEmi: true, kind: 'emi', active: true, sortOrder: 1 },
    { bank: 'ICICI Bank', bankLogo: '/images/banks/icici.png', tenureMonths: 3, interestRate: 0, minAmount: 500000, noCostEmi: true, kind: 'emi', active: true, sortOrder: 2 },
    { bank: 'SBI', bankLogo: '/images/banks/sbi.png', tenureMonths: 3, interestRate: 0, minAmount: 500000, noCostEmi: true, kind: 'emi', active: true, sortOrder: 3 },
  ] });

  // ═══════════════════════════════════════════════════════════════
  // PRODUCTS — 65 items across all categories
  // ═══════════════════════════════════════════════════════════════

  const IMG = {
    linenShirt: '/images/product-linen-shirt.webp',
    linenDetail: '/images/product-linen-detail.webp',
    shirtWorn: '/images/product-shirt-worn.webp',
    silkShirt: '/images/product-silk-shirt.webp',
    wrapDress: '/images/product-wrap-dress.webp',
    dressBack: '/images/product-dress-back.webp',
    merino: '/images/product-merino-wool.webp',
    cashmere: '/images/product-cashmere-scarf.webp',
  };

  const black = { name: 'Black', hex: '#111111' };
  const white = { name: 'White', hex: '#FFFFFF' };
  const navy = { name: 'Navy', hex: '#1B2A4A' };
  const charcoal = { name: 'Charcoal', hex: '#333333' };
  const cream = { name: 'Cream', hex: '#FFFDD0' };
  const natural = { name: 'Natural', hex: '#F5F0E1' };
  const sage = { name: 'Sage', hex: '#8A9A7B' };
  const sand = { name: 'Sand', hex: '#C2B280' };
  const terracotta = { name: 'Terracotta', hex: '#C67D5B' };
  const camel = { name: 'Camel', hex: '#C19A6B' };
  const oatmeal = { name: 'Oatmeal', hex: '#D9D2C4' };
  const olive = { name: 'Olive', hex: '#556B2F' };
  const ivory = { name: 'Ivory', hex: '#FFFFF0' };
  const khaki = { name: 'Khaki', hex: '#BDB76B' };
  const midnight = { name: 'Midnight', hex: '#191970' };

  const WSizes = ['XS','S','M','L','XL'];
  const MSizes = ['S','M','L','XL','XXL'];
  const OSizes = ['OS'];

  const products: ProductDef[] = [
    // ── WOMEN'S TOPS (8) ─────────────────────────────
    { slug: 'linen-oversized-shirt', name: 'Linen Oversized Shirt', subtitle: 'Breathable comfort meets relaxed tailoring', description: 'Crafted from 100% European linen with dropped shoulders and curved hem.', basePrice: 490000, compareAtPrice: 650000, fabric: '100% European Linen (180 GSM)', occasion: 'casual', fit: 'oversized', gender: 'unisex', hsnCode: '6205', categoryId: unisex.id, images: [{ url: IMG.linenShirt, alt: 'Linen Shirt', kind: 'gallery', colorKey: 'natural', sortOrder: 1 }, { url: IMG.linenDetail, alt: 'Linen Detail', kind: 'gallery', colorKey: 'natural', sortOrder: 2 }], sizes: WSizes, colors: [natural, charcoal, sage], tags: ['linen','sustainable','minimalist','oversized'], collections: [lumenEdit.id, summerEssentials.id], featured: true },
    { slug: 'silk-mandarin-shirt', name: 'Silk Blend Mandarin Shirt', subtitle: 'Luminous drape with refined collar', description: 'Silk-cotton blend with concealed placket and French seams.', basePrice: 720000, compareAtPrice: 950000, fabric: '55% Silk, 45% Cotton (120 GSM)', occasion: 'formal', fit: 'regular', gender: 'men', hsnCode: '6205', categoryId: menShirts.id, images: [{ url: IMG.silkShirt, alt: 'Silk Mandarin', kind: 'gallery', colorKey: 'ivory', sortOrder: 1 }], sizes: ['S','M','L','XL'], colors: [ivory, midnight], tags: ['silk','formal','minimalist'], collections: [lumenEdit.id, workwear.id], featured: true },
    { slug: 'cotton-wrap-dress', name: 'Cotton Poplin Wrap Dress', subtitle: 'Effortless elegance with tie waist', description: 'Crisp cotton poplin wrap dress with midi length and pockets.', basePrice: 680000, compareAtPrice: 880000, fabric: '100% Organic Cotton Poplin (110 GSM)', occasion: 'casual', fit: 'regular', gender: 'women', hsnCode: '6204', categoryId: womenDresses.id, images: [{ url: IMG.wrapDress, alt: 'Wrap Dress', kind: 'gallery', colorKey: 'white', sortOrder: 1 }, { url: IMG.dressBack, alt: 'Dress Back', kind: 'gallery', colorKey: 'white', sortOrder: 2 }], sizes: WSizes, colors: [white, navy], tags: ['cotton','sustainable','workwear'], collections: [lumenEdit.id, workwear.id], featured: true },
    { slug: 'merino-crew-neck', name: 'Merino Wool Crew Neck', subtitle: 'Temperature-regulating luxury', description: '18.5 micron merino wool, odor-resistant and moisture-wicking.', basePrice: 550000, compareAtPrice: 720000, fabric: '100% Merino Wool (220 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'unisex', hsnCode: '6110', categoryId: unisexKnitwear.id, images: [{ url: IMG.merino, alt: 'Merino Crew', kind: 'gallery', colorKey: 'oatmeal', sortOrder: 1 }], sizes: WSizes, colors: [oatmeal, charcoal], tags: ['wool','sustainable','layering'], collections: [winterWarmers.id] },
    { slug: 'cashmere-scarf', name: 'Cashmere Blend Scarf', subtitle: 'Cloud-soft warmth in generous drape', description: 'Premium cashmere-wool blend oversized scarf.', basePrice: 850000, compareAtPrice: 1100000, fabric: '30% Cashmere, 70% Merino Wool', occasion: 'formal', fit: 'oversized', gender: 'unisex', hsnCode: '6214', categoryId: unisexAccessories.id, images: [{ url: IMG.cashmere, alt: 'Cashmere Scarf', kind: 'gallery', colorKey: 'camel', sortOrder: 1 }], sizes: OSizes, colors: [camel, charcoal, ivory], tags: ['cashmere','wool','statement','layering'], collections: [winterWarmers.id, lumenEdit.id], featured: true },
    { slug: 'silk-camisole', name: 'Silk Camisole Top', subtitle: 'Delicate straps, luminous silk', description: 'Bias-cut mulberry silk camisole with adjustable spaghetti straps.', basePrice: 420000, compareAtPrice: 550000, fabric: '100% Mulberry Silk (16 Momme)', occasion: 'evening', fit: 'regular', gender: 'women', hsnCode: '6202', categoryId: womenTops.id, images: [{ url: IMG.silkShirt, alt: 'Silk Camisole', kind: 'gallery', colorKey: 'blush', sortOrder: 1 }], sizes: ['XS','S','M','L'], colors: [{ name: 'Blush', hex: '#DE929A' }, black], tags: ['silk','evening','minimalist'], collections: [newArrivals.id] },
    { slug: 'linen-button-blouse', name: 'Linen Button-Front Blouse', subtitle: 'Relaxed tailoring for everyday', description: 'Garment-washed linen blouse with mother-of-pearl buttons.', basePrice: 380000, compareAtPrice: 480000, fabric: '100% French Linen (160 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'women', hsnCode: '6206', categoryId: womenTops.id, images: [{ url: IMG.linenShirt, alt: 'Linen Blouse', kind: 'gallery', colorKey: 'cloud', sortOrder: 1 }], sizes: WSizes, colors: [{ name: 'Cloud', hex: '#E8E4DF' }, terracotta], tags: ['linen','sustainable','casual'], collections: [summerEssentials.id] },
    { slug: 'organic-cotton-tee', name: 'Organic Cotton Essential Tee', subtitle: 'The perfect everyday tee', description: 'Boxy-fit heavyweight organic cotton jersey, pre-washed.', basePrice: 180000, compareAtPrice: 220000, fabric: '100% Organic Cotton (220 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'unisex', hsnCode: '6109', categoryId: womenTops.id, images: [{ url: IMG.linenDetail, alt: 'Cotton Tee', kind: 'gallery', colorKey: 'white', sortOrder: 1 }], sizes: WSizes, colors: [white, black], tags: ['cotton','sustainable','casual'], collections: [newArrivals.id, summerEssentials.id] },

    // ── WOMEN'S DRESSES (6) ──────────────────────────
    { slug: 'midi-shirt-dress', name: 'Midi Shirt Dress', subtitle: 'Tailored ease from desk to dinner', description: 'Structured cotton twill shirt dress with belted waist.', basePrice: 720000, compareAtPrice: 920000, fabric: '100% Organic Cotton Twill (180 GSM)', occasion: 'workwear', fit: 'regular', gender: 'women', hsnCode: '6204', categoryId: womenDresses.id, images: [{ url: IMG.wrapDress, alt: 'Shirt Dress', kind: 'gallery', colorKey: 'khaki', sortOrder: 1 }], sizes: WSizes, colors: [khaki, white], tags: ['cotton','workwear','tailored'], collections: [workwear.id], featured: true },
    { slug: 'midi-slip-dress', name: 'Midi Slip Dress', subtitle: 'Understated glamour in bias-cut silk', description: 'Bias-cut washed silk charmeuse with adjustable straps.', basePrice: 880000, compareAtPrice: 1150000, fabric: '100% Silk Charmeuse (19 Momme)', occasion: 'evening', fit: 'regular', gender: 'women', hsnCode: '6204', categoryId: womenDresses.id, images: [{ url: IMG.silkShirt, alt: 'Slip Dress', kind: 'gallery', colorKey: 'champagne', sortOrder: 1 }], sizes: WSizes, colors: [{ name: 'Champagne', hex: '#F7E7CE' }, black], tags: ['silk','evening','statement'], collections: [newArrivals.id], featured: true },
    { slug: 'linen-maxi-dress', name: 'Linen Maxi Dress', subtitle: 'Floor-length ease in breathable linen', description: 'Relaxed maxi in heavy linen with square neckline and puff sleeves.', basePrice: 780000, compareAtPrice: 980000, fabric: '100% European Linen (200 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'women', hsnCode: '6204', categoryId: womenDresses.id, images: [{ url: IMG.linenShirt, alt: 'Maxi Dress', kind: 'gallery', colorKey: 'oat', sortOrder: 1 }], sizes: WSizes, colors: [{ name: 'Oat', hex: '#D4C5A9' }, olive], tags: ['linen','sustainable','casual'], collections: [summerEssentials.id] },
    { slug: 'ribbed-knit-dress', name: 'Ribbed Knit Midi Dress', subtitle: 'Second-skin comfort in premium rib', description: 'Body-skimming fine-gauge rib knit with mock neckline.', basePrice: 520000, compareAtPrice: 680000, fabric: '95% Viscose, 5% Elastane (240 GSM)', occasion: 'casual', fit: 'regular', gender: 'women', hsnCode: '6114', categoryId: womenDresses.id, images: [{ url: IMG.merino, alt: 'Knit Dress', kind: 'gallery', colorKey: 'mocha', sortOrder: 1 }], sizes: WSizes, colors: [{ name: 'Mocha', hex: '#967969' }, black], tags: ['casual','minimalist','layering'], collections: [newArrivals.id] },
    { slug: 'tiered-cotton-dress', name: 'Tiered Cotton Midi Dress', subtitle: 'Volume and movement in organic cotton', description: 'Three-tier cotton voile with smocked bodice and puff sleeves.', basePrice: 580000, compareAtPrice: 750000, fabric: '100% Organic Cotton Voile (90 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'women', hsnCode: '6204', categoryId: womenDresses.id, images: [{ url: IMG.wrapDress, alt: 'Tiered Dress', kind: 'gallery', colorKey: 'lavender', sortOrder: 1 }], sizes: WSizes, colors: [{ name: 'Lavender', hex: '#B57EDC' }, cream], tags: ['cotton','sustainable','casual'], collections: [summerEssentials.id] },
    { slug: 'wrap-blouse-dress', name: 'Wrap Blouse Dress', subtitle: 'Versatile two-piece styling', description: 'Flowing Tencel wrap-front dress with self-tie belt.', basePrice: 620000, compareAtPrice: 800000, fabric: '100% Tencel Lyocell (150 GSM)', occasion: 'workwear', fit: 'regular', gender: 'women', hsnCode: '6204', categoryId: womenDresses.id, images: [{ url: IMG.dressBack, alt: 'Wrap Dress', kind: 'gallery', colorKey: 'slate', sortOrder: 1 }], sizes: WSizes, colors: [{ name: 'Slate', hex: '#708090' }], tags: ['tencel','workwear','sustainable'], collections: [workwear.id] },

    // ── WOMEN'S BOTTOMS (5) ──────────────────────────
    { slug: 'wide-leg-trousers', name: 'High-Waist Wide Leg Trousers', subtitle: 'Architectural silhouette with fluid movement', description: 'High-rise wide-leg in heavy crepe with pressed pleats.', basePrice: 650000, compareAtPrice: 850000, fabric: '100% Wool Crepe (280 GSM)', occasion: 'workwear', fit: 'regular', gender: 'women', hsnCode: '6204', categoryId: womenBottoms.id, images: [{ url: IMG.linenDetail, alt: 'Wide Leg', kind: 'gallery', colorKey: 'black', sortOrder: 1 }], sizes: WSizes, colors: [black, cream], tags: ['wool','workwear','tailored'], collections: [workwear.id], featured: true },
    { slug: 'linen-wide-pants', name: 'Linen Wide-Leg Pants', subtitle: 'Relaxed sophistication for warm days', description: 'Drawstring waist linen pants with side pockets.', basePrice: 420000, compareAtPrice: 550000, fabric: '100% European Linen (170 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'women', hsnCode: '6204', categoryId: womenBottoms.id, images: [{ url: IMG.linenShirt, alt: 'Linen Pants', kind: 'gallery', colorKey: 'sand', sortOrder: 1 }], sizes: WSizes, colors: [sand, white], tags: ['linen','sustainable','casual'], collections: [summerEssentials.id] },
    { slug: 'slim-chinos-w', name: 'Slim Fit Chinos', subtitle: 'Precision-cut for modern silhouette', description: 'Stretch cotton twill chinos with tapered leg.', basePrice: 380000, compareAtPrice: 480000, fabric: '98% Cotton, 2% Elastane (260 GSM)', occasion: 'casual', fit: 'slim', gender: 'women', hsnCode: '6204', categoryId: womenBottoms.id, images: [{ url: IMG.linenDetail, alt: 'Chinos', kind: 'gallery', colorKey: 'taupe', sortOrder: 1 }], sizes: WSizes, colors: [{ name: 'Taupe', hex: '#B39B8A' }, navy], tags: ['cotton','casual','tailored'], collections: [newArrivals.id] },
    { slug: 'denim-wide-leg', name: 'Wide Leg Denim', subtitle: 'Vintage-inspired with modern proportions', description: 'High-rise wide-leg jeans in premium selvedge denim.', basePrice: 520000, compareAtPrice: 680000, fabric: '100% Selvedge Denim (12oz)', occasion: 'casual', fit: 'relaxed', gender: 'women', hsnCode: '6203', categoryId: womenBottoms.id, images: [{ url: IMG.linenDetail, alt: 'Wide Denim', kind: 'gallery', colorKey: 'indigo', sortOrder: 1 }], sizes: WSizes, colors: [{ name: 'Indigo', hex: '#3F5D8C' }, black], tags: ['denim','casual','statement'], collections: [newArrivals.id] },
    { slug: 'tailored-culottes', name: 'Tailored Culottes', subtitle: 'Skirt-like movement, trouser functionality', description: 'Wide-leg culottes in structured cotton with high waist.', basePrice: 450000, compareAtPrice: 580000, fabric: '100% Organic Cotton Twill (220 GSM)', occasion: 'workwear', fit: 'regular', gender: 'women', hsnCode: '6204', categoryId: womenBottoms.id, images: [{ url: IMG.linenDetail, alt: 'Culottes', kind: 'gallery', colorKey: 'stone', sortOrder: 1 }], sizes: WSizes, colors: [{ name: 'Stone', hex: '#928E85' }], tags: ['cotton','workwear','tailored'], collections: [workwear.id] },

    // ── WOMEN'S OUTERWEAR (4) ────────────────────────
    { slug: 'linen-blazer-w', name: 'Unstructured Linen Blazer', subtitle: 'Sharp tailoring without stiffness', description: 'Relaxed linen blazer with notch lapels and patch pockets.', basePrice: 850000, compareAtPrice: 1100000, fabric: '100% European Linen (220 GSM)', occasion: 'workwear', fit: 'relaxed', gender: 'women', hsnCode: '6201', categoryId: womenOuterwear.id, images: [{ url: IMG.linenShirt, alt: 'Linen Blazer', kind: 'gallery', colorKey: 'sand', sortOrder: 1 }], sizes: ['XS','S','M','L'], colors: [sand, black], tags: ['linen','workwear','tailored','layering'], collections: [workwear.id, summerEssentials.id], featured: true },
    { slug: 'cashmere-cardigan', name: 'Cashmere Oversized Cardigan', subtitle: 'Wrap yourself in pure luxury', description: 'Open-front 100% Grade A cashmere with deep patch pockets.', basePrice: 1450000, compareAtPrice: 1850000, fabric: '100% Grade A Cashmere (350 GSM)', occasion: 'casual', fit: 'oversized', gender: 'women', hsnCode: '6110', categoryId: womenOuterwear.id, images: [{ url: IMG.cashmere, alt: 'Cardigan', kind: 'gallery', colorKey: 'oatmeal', sortOrder: 1 }], sizes: ['S','M','L'], colors: [oatmeal, camel], tags: ['cashmere','layering','oversized'], collections: [winterWarmers.id], featured: true },
    { slug: 'classic-trench', name: 'Classic Trench Coat', subtitle: 'Timeless rain-or-shine protection', description: 'Double-breasted cotton gabardine with storm flap and belt.', basePrice: 1250000, compareAtPrice: 1600000, fabric: '100% Cotton Gabardine (320 GSM)', occasion: 'formal', fit: 'regular', gender: 'women', hsnCode: '6201', categoryId: womenOuterwear.id, images: [{ url: IMG.linenDetail, alt: 'Trench', kind: 'gallery', colorKey: 'khaki', sortOrder: 1 }], sizes: WSizes, colors: [khaki, black], tags: ['cotton','formal','statement'], collections: [monsoonReady.id] },
    { slug: 'quilted-vest', name: 'Lightweight Quilted Vest', subtitle: 'Layering essential for transitional weather', description: 'Sleeveless quilted vest in ripstop nylon with synthetic insulation.', basePrice: 480000, compareAtPrice: 620000, fabric: 'Nylon Shell, Synthetic Fill', occasion: 'casual', fit: 'regular', gender: 'unisex', hsnCode: '6201', categoryId: unisexOuterwear.id, images: [{ url: IMG.linenDetail, alt: 'Quilted Vest', kind: 'gallery', colorKey: 'olive', sortOrder: 1 }], sizes: ['S','M','L','XL'], colors: [olive, navy], tags: ['layering','casual'], collections: [monsoonReady.id] },

    // ── WOMEN'S KNITWEAR (2) ─────────────────────────
    { slug: 'mohair-pullover', name: 'Mohair Blend Pullover', subtitle: 'Textured warmth with halo effect', description: 'Relaxed mohair-wool blend with brushed surface.', basePrice: 680000, compareAtPrice: 880000, fabric: '40% Mohair, 60% Wool (260 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'women', hsnCode: '6110', categoryId: womenKnitwear.id, images: [{ url: IMG.merino, alt: 'Mohair', kind: 'gallery', colorKey: 'dusty-rose', sortOrder: 1 }], sizes: ['XS','S','M','L'], colors: [{ name: 'Dusty Rose', hex: '#D4A5A5' }], tags: ['wool','casual','layering'], collections: [winterWarmers.id] },
    { slug: 'ribbed-turtleneck', name: 'Fine-Gauge Ribbed Turtleneck', subtitle: 'Sleek layering in featherweight knit', description: 'Slim-fit extra-fine merino turtleneck.', basePrice: 380000, compareAtPrice: 480000, fabric: '100% Extra-Fine Merino (120 GSM)', occasion: 'workwear', fit: 'slim', gender: 'women', hsnCode: '6110', categoryId: womenKnitwear.id, images: [{ url: IMG.merino, alt: 'Turtleneck', kind: 'gallery', colorKey: 'black', sortOrder: 1 }], sizes: WSizes, colors: [black, cream], tags: ['wool','workwear','layering'], collections: [winterWarmers.id, workwear.id] },

    // ── MEN'S SHIRTS (8) ─────────────────────────────
    { slug: 'oxford-button-down', name: 'Oxford Button-Down Shirt', subtitle: 'Backbone of every smart wardrobe', description: 'Classic oxford cloth with button-down collar and chest pocket.', basePrice: 350000, compareAtPrice: 450000, fabric: '100% Cotton Oxford (160 GSM)', occasion: 'casual', fit: 'regular', gender: 'men', hsnCode: '6205', categoryId: menShirts.id, images: [{ url: IMG.linenShirt, alt: 'Oxford', kind: 'gallery', colorKey: 'blue', sortOrder: 1 }], sizes: MSizes, colors: [{ name: 'Blue', hex: '#6B8EAC' }, white], tags: ['cotton','workwear','tailored'], collections: [workwear.id] },
    { slug: 'camp-collar-shirt', name: 'Linen Camp Collar Shirt', subtitle: 'Vacation-ready relaxation', description: 'Boxy camp collar in garment-washed linen.', basePrice: 420000, compareAtPrice: 550000, fabric: '100% European Linen (150 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'men', hsnCode: '6205', categoryId: menShirts.id, images: [{ url: IMG.linenShirt, alt: 'Camp Collar', kind: 'gallery', colorKey: 'terracotta', sortOrder: 1 }], sizes: ['S','M','L','XL'], colors: [terracotta, sage], tags: ['linen','sustainable','casual'], collections: [summerEssentials.id, newArrivals.id], featured: true },
    { slug: 'slim-poplin-shirt', name: 'Slim Fit Poplin Shirt', subtitle: 'Crisp, clean, perfectly tailored', description: 'Non-iron cotton poplin with semi-spread collar.', basePrice: 450000, compareAtPrice: 580000, fabric: '100% Cotton Poplin (130 GSM)', occasion: 'formal', fit: 'slim', gender: 'men', hsnCode: '6205', categoryId: menShirts.id, images: [{ url: IMG.silkShirt, alt: 'Poplin', kind: 'gallery', colorKey: 'white', sortOrder: 1 }], sizes: ['S','M','L','XL'], colors: [white, { name: 'Light Blue', hex: '#ADD8E6' }], tags: ['cotton','formal','tailored'], collections: [workwear.id] },
    { slug: 'brushed-flannel', name: 'Brushed Flannel Shirt', subtitle: 'Cozy warmth in heritage plaid', description: 'Relaxed brushed cotton flannel with button-down collar.', basePrice: 420000, compareAtPrice: 540000, fabric: '100% Cotton Flannel (180 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'men', hsnCode: '6205', categoryId: menShirts.id, images: [{ url: IMG.linenDetail, alt: 'Flannel', kind: 'gallery', colorKey: 'grey-plaid', sortOrder: 1 }], sizes: MSizes, colors: [{ name: 'Grey Plaid', hex: '#808080' }, { name: 'Rust Plaid', hex: '#B7410E' }], tags: ['cotton','casual','layering'], collections: [winterWarmers.id] },
    { slug: 'western-denim-shirt', name: 'Denim Western Shirt', subtitle: 'Rugged charm meets refined construction', description: 'Western-style snap button shirt in medium-wash denim.', basePrice: 480000, compareAtPrice: 620000, fabric: '100% Cotton Denim (10oz)', occasion: 'casual', fit: 'regular', gender: 'men', hsnCode: '6205', categoryId: menShirts.id, images: [{ url: IMG.linenDetail, alt: 'Western', kind: 'gallery', colorKey: 'indigo', sortOrder: 1 }], sizes: ['S','M','L','XL'], colors: [{ name: 'Indigo', hex: '#3F5D8C' }], tags: ['denim','casual','statement'], collections: [newArrivals.id] },
    { slug: 'grandad-collar-shirt', name: 'Linen Grandad Collar Shirt', subtitle: 'Heritage style, modern sensibility', description: 'Relaxed linen shirt with vintage grandad collar.', basePrice: 440000, compareAtPrice: 560000, fabric: '100% European Linen (170 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'men', hsnCode: '6205', categoryId: menShirts.id, images: [{ url: IMG.linenShirt, alt: 'Grandad', kind: 'gallery', colorKey: 'natural', sortOrder: 1 }], sizes: ['S','M','L','XL'], colors: [natural, { name: 'Sky Blue', hex: '#87CEEB' }], tags: ['linen','sustainable','casual'], collections: [summerEssentials.id] },
    { slug: 'corduroy-shirt', name: 'Washed Corduroy Shirt', subtitle: 'Textured warmth in fine-wale corduroy', description: 'Garment-washed fine-wale corduroy with spread collar.', basePrice: 460000, compareAtPrice: 580000, fabric: '100% Cotton Corduroy (14-wale)', occasion: 'casual', fit: 'relaxed', gender: 'men', hsnCode: '6205', categoryId: menShirts.id, images: [{ url: IMG.linenDetail, alt: 'Corduroy', kind: 'gallery', colorKey: 'tobacco', sortOrder: 1 }], sizes: MSizes, colors: [{ name: 'Tobacco', hex: '#7B5B3A' }], tags: ['cotton','casual','layering'], collections: [winterWarmers.id] },
    { slug: 'tropical-camp-shirt', name: 'Tropical Print Camp Shirt', subtitle: 'Bold botanicals on lightweight rayon', description: 'Relaxed camp collar shirt in printed rayon.', basePrice: 380000, compareAtPrice: 480000, fabric: '100% Rayon (110 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'men', hsnCode: '6205', categoryId: menShirts.id, images: [{ url: IMG.linenShirt, alt: 'Tropical', kind: 'gallery', colorKey: 'green', sortOrder: 1 }], sizes: MSizes, colors: [{ name: 'Green', hex: '#2E8B57' }], tags: ['statement','casual'], collections: [summerEssentials.id] },

    // ── MEN'S TROUSERS (5) ───────────────────────────
    { slug: 'pleated-chinos', name: 'Pleated Chinos', subtitle: 'Classic tailoring with modern rise', description: 'High-rise pleated chinos in brushed cotton twill.', basePrice: 480000, compareAtPrice: 620000, fabric: '100% Brushed Cotton Twill (280 GSM)', occasion: 'workwear', fit: 'regular', gender: 'men', hsnCode: '6203', categoryId: menTrousers.id, images: [{ url: IMG.linenDetail, alt: 'Chinos', kind: 'gallery', colorKey: 'khaki', sortOrder: 1 }], sizes: MSizes, colors: [khaki, navy], tags: ['cotton','workwear','tailored'], collections: [workwear.id], featured: true },
    { slug: 'wool-trousers', name: 'Tailored Wool Trousers', subtitle: 'Refined drape in premium wool', description: 'Flat-front wool trousers with pressed crease.', basePrice: 680000, compareAtPrice: 880000, fabric: '100% Italian Wool Crepe (260 GSM)', occasion: 'formal', fit: 'regular', gender: 'men', hsnCode: '6203', categoryId: menTrousers.id, images: [{ url: IMG.linenDetail, alt: 'Wool Trousers', kind: 'gallery', colorKey: 'charcoal', sortOrder: 1 }], sizes: MSizes, colors: [charcoal, navy], tags: ['wool','formal','tailored'], collections: [workwear.id] },
    { slug: 'relaxed-linen-pants', name: 'Relaxed Linen Pants', subtitle: 'Easy wear for laid-back days', description: 'Drawstring waist linen pants with elasticated back.', basePrice: 380000, compareAtPrice: 480000, fabric: '100% European Linen (160 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'men', hsnCode: '6203', categoryId: menTrousers.id, images: [{ url: IMG.linenShirt, alt: 'Linen Pants', kind: 'gallery', colorKey: 'stone', sortOrder: 1 }], sizes: MSizes, colors: [{ name: 'Stone', hex: '#928E85' }, white], tags: ['linen','sustainable','casual'], collections: [summerEssentials.id] },
    { slug: 'selvedge-jeans', name: 'Slim Selvedge Jeans', subtitle: 'Japanese denim, Indian craft', description: 'Raw selvedge denim from Okayama, Japan.', basePrice: 720000, compareAtPrice: 920000, fabric: '100% Japanese Selvedge Denim (14oz)', occasion: 'casual', fit: 'slim', gender: 'men', hsnCode: '6203', categoryId: menTrousers.id, images: [{ url: IMG.linenDetail, alt: 'Selvedge', kind: 'gallery', colorKey: 'raw-indigo', sortOrder: 1 }], sizes: MSizes, colors: [{ name: 'Raw Indigo', hex: '#2C3E6B' }, black], tags: ['denim','casual','statement'], collections: [newArrivals.id], featured: true },
    { slug: 'cargo-pants', name: 'Cotton Cargo Pants', subtitle: 'Utility meets sophistication', description: 'Relaxed cargo in washed cotton twill with bellows pockets.', basePrice: 450000, compareAtPrice: 580000, fabric: '100% Cotton Twill (240 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'men', hsnCode: '6203', categoryId: menTrousers.id, images: [{ url: IMG.linenDetail, alt: 'Cargo', kind: 'gallery', colorKey: 'olive', sortOrder: 1 }], sizes: MSizes, colors: [olive, khaki], tags: ['cotton','casual'], collections: [newArrivals.id] },

    // ── MEN'S OUTERWEAR (4) ──────────────────────────
    { slug: 'wool-overcoat', name: 'Wool Overcoat', subtitle: 'Commanding presence in premium wool', description: 'Double-breasted overcoat in heavy wool with peak lapels.', basePrice: 1650000, compareAtPrice: 2100000, fabric: '80% Wool, 20% Polyester (450 GSM)', occasion: 'formal', fit: 'regular', gender: 'men', hsnCode: '6201', categoryId: menOuterwear.id, images: [{ url: IMG.linenDetail, alt: 'Overcoat', kind: 'gallery', colorKey: 'charcoal', sortOrder: 1 }], sizes: ['S','M','L','XL'], colors: [charcoal, camel], tags: ['wool','formal','statement'], collections: [winterWarmers.id], featured: true },
    { slug: 'harrington-jacket', name: 'Cotton Harrington Jacket', subtitle: 'Casual sophistication', description: 'Classic Harrington in cotton twill with ribbed trims.', basePrice: 650000, compareAtPrice: 820000, fabric: '100% Cotton Twill (200 GSM)', occasion: 'casual', fit: 'regular', gender: 'men', hsnCode: '6201', categoryId: menOuterwear.id, images: [{ url: IMG.linenDetail, alt: 'Harrington', kind: 'gallery', colorKey: 'navy', sortOrder: 1 }], sizes: ['S','M','L','XL'], colors: [navy, olive], tags: ['cotton','casual','layering'], collections: [monsoonReady.id] },
    { slug: 'satin-bomber', name: 'Washed Satin Bomber', subtitle: 'Streetwise edge in premium satin', description: 'Relaxed bomber in washed cotton satin with quilted lining.', basePrice: 780000, compareAtPrice: 980000, fabric: '100% Cotton Satin (220 GSM)', occasion: 'casual', fit: 'relaxed', gender: 'men', hsnCode: '6201', categoryId: menOuterwear.id, images: [{ url: IMG.linenDetail, alt: 'Bomber', kind: 'gallery', colorKey: 'black', sortOrder: 1 }], sizes: ['S','M','L','XL'], colors: [black], tags: ['casual','statement','layering'], collections: [newArrivals.id] },
    { slug: 'mac-raincoat', name: 'Water-Resistant Mac Coat', subtitle: 'Clean lines, all-weather protection', description: 'Minimalist mac in water-resistant cotton with snap closure.', basePrice: 880000, compareAtPrice: 1100000, fabric: '100% Water-Resistant Cotton (280 GSM)', occasion: 'formal', fit: 'regular', gender: 'men', hsnCode: '6201', categoryId: menOuterwear.id, images: [{ url: IMG.linenDetail, alt: 'Mac Coat', kind: 'gallery', colorKey: 'black', sortOrder: 1 }], sizes: ['S','M','L','XL'], colors: [black], tags: ['cotton','formal','layering'], collections: [monsoonReady.id] },

    // ── MEN'S KNITWEAR (3) ───────────────────────────
    { slug: 'cable-knit-sweater', name: 'Cable-Knit Wool Sweater', subtitle: 'Heritage texture in premium wool', description: 'Classic cable-knit in Aran-weight merino wool.', basePrice: 620000, compareAtPrice: 800000, fabric: '100% Merino Wool (350 GSM)', occasion: 'casual', fit: 'regular', gender: 'men', hsnCode: '6110', categoryId: menKnitwear.id, images: [{ url: IMG.merino, alt: 'Cable Knit', kind: 'gallery', colorKey: 'oatmeal', sortOrder: 1 }], sizes: ['S','M','L','XL'], colors: [oatmeal, navy], tags: ['wool','casual','layering'], collections: [winterWarmers.id] },
    { slug: 'merino-crew-m', name: 'Merino Crew Neck', subtitle: 'Essential layering piece', description: 'Fine-gauge merino crew neck with ribbed trims.', basePrice: 420000, compareAtPrice: 540000, fabric: '100% Extra-Fine Merino (180 GSM)', occasion: 'casual', fit: 'regular', gender: 'men', hsnCode: '6110', categoryId: menKnitwear.id, images: [{ url: IMG.merino, alt: 'Merino Crew', kind: 'gallery', colorKey: 'charcoal', sortOrder: 1 }], sizes: ['S','M','L','XL'], colors: [charcoal, camel], tags: ['wool','layering','minimalist'], collections: [winterWarmers.id] },
    { slug: 'quarter-zip-sweater', name: 'Quarter-Zip Sweater', subtitle: 'Athletic ease meets refined knit', description: 'Quarter-zip in brushed wool blend with stand collar.', basePrice: 520000, compareAtPrice: 680000, fabric: '70% Wool, 30% Cashmere (280 GSM)', occasion: 'casual', fit: 'regular', gender: 'men', hsnCode: '6110', categoryId: menKnitwear.id, images: [{ url: IMG.merino, alt: 'Quarter-Zip', kind: 'gallery', colorKey: 'forest', sortOrder: 1 }], sizes: ['S','M','L','XL'], colors: [{ name: 'Forest', hex: '#228B22' }], tags: ['wool','cashmere','layering'], collections: [winterWarmers.id] },

    // ── UNISEX ACCESSORIES (3) ───────────────────────
    { slug: 'leather-belt', name: 'Full-Grain Leather Belt', subtitle: 'Handcrafted in Indian tanneries', description: 'Vegetable-tanned full-grain leather with brass buckle.', basePrice: 350000, compareAtPrice: 450000, fabric: '100% Full-Grain Leather', occasion: 'casual', fit: 'regular', gender: 'unisex', hsnCode: '4203', categoryId: unisexAccessories.id, images: [{ url: IMG.linenDetail, alt: 'Leather Belt', kind: 'gallery', colorKey: 'cognac', sortOrder: 1 }], sizes: ['S','M','L'], colors: [{ name: 'Cognac', hex: '#834A25' }, black], tags: ['sustainable','minimalist'], collections: [] },
    { slug: 'canvas-tote', name: 'Organic Canvas Tote', subtitle: 'Everyday carry in heavy canvas', description: 'Heavyweight organic cotton canvas with leather handles.', basePrice: 280000, compareAtPrice: 350000, fabric: '100% Organic Cotton Canvas (18oz)', occasion: 'casual', fit: 'regular', gender: 'unisex', hsnCode: '4202', categoryId: unisexAccessories.id, images: [{ url: IMG.linenDetail, alt: 'Canvas Tote', kind: 'gallery', colorKey: 'natural', sortOrder: 1 }], sizes: OSizes, colors: [natural, black], tags: ['cotton','sustainable','casual'], collections: [] },
    { slug: 'merino-beanie', name: 'Merino Wool Beanie', subtitle: 'Winter warmth in fine-gauge knit', description: 'Cuffed beanie in extra-fine merino wool.', basePrice: 180000, compareAtPrice: 240000, fabric: '100% Extra-Fine Merino Wool', occasion: 'casual', fit: 'regular', gender: 'unisex', hsnCode: '6111', categoryId: unisexAccessories.id, images: [{ url: IMG.merino, alt: 'Beanie', kind: 'gallery', colorKey: 'charcoal', sortOrder: 1 }], sizes: OSizes, colors: [charcoal, oatmeal, navy], tags: ['wool','layering'], collections: [winterWarmers.id] },
  ];

  // ── Create all products ─────────────────────────────────────
  for (const p of products) {
    const { sizes, colors, tags: tagSlugs, collections: collIds, ...pData } = p;
    const variants = mkVariants(sizes, colors, 20, 300);
    const product = await prisma.product.create({
      data: {
        ...pData,
        status: 'active',
        story: pData.description,
        careJson: '["Machine wash cold","Do not bleach","Tumble dry low"]',
        images: { create: p.images },
        variants: { create: variants.map(v => ({ ...v, sku: `${p.slug.toUpperCase()}-${v.size}-${v.color.toUpperCase().slice(0,3)}` })) },
        tags: { create: tagSlugs.map(slug => ({ tag: { connect: { slug } } })) },
        collections: { create: collIds.map(collectionId => ({ collectionId })) },
      },
    });
    console.log(`  Created: ${product.name} (${variants.length} variants)`);
  }

  // ── Test User ───────────────────────────────────────────────
  const testUser = await prisma.user.create({ data: {
    email: 'test@lumenandco.example', phone: '+919876543210',
    passwordHash: await hashPassword('Test@12345'), name: 'Test Customer',
    emailVerifiedAt: new Date(), phoneVerifiedAt: new Date(),
    gender: 'unisex', referralCode: await generateReferralCode('Test Customer'),
    loyaltyTier: 'bronze', loyaltyPoints: 500,
  }});

  await prisma.wallet.create({ data: { userId: testUser.id, balance: 100000, lockedBalance: 0, totalEarned: 100000, totalWithdrawn: 0 } });

  await prisma.address.create({ data: {
    userId: testUser.id, label: 'home', name: 'Test Customer', phone: '+919876543210',
    line1: '123 MG Road', line2: 'Near Metro Station', city: 'Bangalore',
    state: 'Karnataka', stateCode: '29', pincode: '560001', country: 'IN', isDefault: true,
  }});

  console.log('✅ Database seeded successfully!');
}

main().catch((e) => { console.error('❌ Seeding failed:', e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
