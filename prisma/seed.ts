import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

/** Human-friendly code (referral codes, coupon codes). */
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

/**
 * Derive a referral code from the user's name plus random entropy, e.g.
 * `AARAV7K2M`. The name stem makes the code feel personal when it's shared,
 * and the random tail keeps it unguessable so nobody can farm codes by
 * enumerating first names.
 *
 * Retries on collision; falls back to a fully random code after a few attempts
 * rather than looping forever on an unlucky stem.
 */
async function generateReferralCode(
  name: string,
  client: PrismaClient = prisma,
): Promise<string> {
  const stem = name
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 5);

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = stem.length >= 3 ? `${stem}${randomCode(4)}` : randomCode(8);
    const clash = await client.user.findUnique({
      where: { referralCode: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }

  // Widen the search space instead of retrying the same shape.
  return `${randomCode(10)}`;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data (in order due to foreign keys)
  await prisma.$transaction([
    prisma.webhookEvent.deleteMany(),
    prisma.settlement.deleteMany(),
    prisma.emiPlan.deleteMany(),
    prisma.savedPaymentMethod.deleteMany(),
    prisma.payoutAttempt.deleteMany(),
    prisma.withdrawalRequest.deleteMany(),
    prisma.bankVerification.deleteMany(),
    prisma.bankAccount.deleteMany(),
    prisma.walletTransaction.deleteMany(),
    prisma.wallet.deleteMany(),
    prisma.referralFraudFlag.deleteMany(),
    prisma.referralCommission.deleteMany(),
    prisma.referral.deleteMany(),
    prisma.referralTier.deleteMany(),
    prisma.referralRule.deleteMany(),
    prisma.couponRedemption.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.loyaltyTransaction.deleteMany(),
    prisma.loyaltyTierDef.deleteMany(),
    prisma.answer.deleteMany(),
    prisma.question.deleteMany(),
    prisma.reviewMedia.deleteMany(),
    prisma.review.deleteMany(),
    prisma.wishlistItem.deleteMany(),
    prisma.inventoryLedger.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.abandonedCart.deleteMany(),
    prisma.shipmentEvent.deleteMany(),
    prisma.shipment.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.orderEvent.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.returnItem.deleteMany(),
    prisma.return.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.paymentAttempt.deleteMany(),
    prisma.paymentIntent.deleteMany(),
    prisma.order.deleteMany(),
    prisma.productTag.deleteMany(),
    prisma.productCollection.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.collection.deleteMany(),
    prisma.sizeGuide.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.address.deleteMany(),
    prisma.pincode.deleteMany(),
    prisma.otpChallenge.deleteMany(),
    prisma.passwordReset.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.user.deleteMany(),
    prisma.staffSession.deleteMany(),
    prisma.staffUser.deleteMany(),
    prisma.staffRole.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.setting.deleteMany(),
  ]);

  // Settings
  await prisma.setting.createMany({
    data: [
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
      { key: 'loyalty.pointsPerHundred', value: '100', valueType: 'number', group: 'payments', label: 'Points per ₹100' },
    ],
  });

  // Loyalty Tiers
  await prisma.loyaltyTierDef.createMany({
    data: [
      { slug: 'bronze', name: 'Bronze', minSpend: 0, pointsMultiplier: 1, perksJson: '["Welcome offer","Birthday gift"]', colorHex: '#CD7F32', sortOrder: 1 },
      { slug: 'silver', name: 'Silver', minSpend: 500000, pointsMultiplier: 1.25, perksJson: '["Free shipping","Early access to sales","Birthday gift"]', colorHex: '#C0C0C0', sortOrder: 2 },
      { slug: 'gold', name: 'Gold', minSpend: 2000000, pointsMultiplier: 1.5, perksJson: '["Free express shipping","VIP support","Exclusive previews","Birthday gift"]', colorHex: '#FFD700', sortOrder: 3, freeShipping: true, earlyAccessHours: 24 },
    ],
  });

  // Staff Roles
  const adminRole = await prisma.staffRole.create({
    data: {
      name: 'Administrator',
      slug: 'admin',
      description: 'Full system access',
      permissionsCsv: 'orders.read,orders.write,products.read,products.write,users.read,users.write,settings.read,settings.write,payouts.approve,analytics.read',
      isSystem: true,
    },
  });

  await prisma.staffRole.create({
    data: {
      name: 'Support Agent',
      slug: 'support',
      description: 'Customer support access',
      permissionsCsv: 'orders.read,orders.write,users.read,refunds.process',
      isSystem: false,
    },
  });

  // Staff User
  await prisma.staffUser.create({
    data: {
      email: 'admin@lumenandco.example',
      passwordHash: await hashPassword('Admin@12345'),
      name: 'Admin User',
      roleId: adminRole.id,
      status: 'active',
    },
  });

  // Categories
  const womenCategory = await prisma.category.create({
    data: {
      slug: 'women',
      name: 'Women',
      description: 'Elevated womenswear for the modern wardrobe',
      sortOrder: 1,
      active: true,
    },
  });

  const menCategory = await prisma.category.create({
    data: {
      slug: 'men',
      name: 'Men',
      description: 'Refined menswear with architectural precision',
      sortOrder: 2,
      active: true,
    },
  });

  const unisexCategory = await prisma.category.create({
    data: {
      slug: 'unisex',
      name: 'Unisex',
      description: 'Gender-fluid pieces designed for everyone',
      sortOrder: 3,
      active: true,
    },
  });

  // Sub-categories
  await prisma.category.createMany({
    data: [
      { slug: 'women-tops', name: 'Tops & Blouses', parentId: womenCategory.id, sortOrder: 1, active: true },
      { slug: 'women-dresses', name: 'Dresses', parentId: womenCategory.id, sortOrder: 2, active: true },
      { slug: 'women-bottoms', name: 'Bottoms', parentId: womenCategory.id, sortOrder: 3, active: true },
      { slug: 'women-outerwear', name: 'Outerwear', parentId: womenCategory.id, sortOrder: 4, active: true },
      { slug: 'men-shirts', name: 'Shirts', parentId: menCategory.id, sortOrder: 1, active: true },
      { slug: 'men-trousers', name: 'Trousers', parentId: menCategory.id, sortOrder: 2, active: true },
      { slug: 'men-outerwear', name: 'Outerwear', parentId: menCategory.id, sortOrder: 3, active: true },
      { slug: 'unisex-knitwear', name: 'Knitwear', parentId: unisexCategory.id, sortOrder: 1, active: true },
      { slug: 'unisex-accessories', name: 'Accessories', parentId: unisexCategory.id, sortOrder: 2, active: true },
    ],
  });

  // Collections
  const lumenEdit = await prisma.collection.create({
    data: {
      slug: 'the-lumen-edit',
      name: 'The Lumen Edit',
      kind: 'seasonal',
      tagline: 'Weightless fabrics. Architectural forms.',
      description: 'A curated selection of our most essential pieces — designed for the modern wardrobe.',
      heroImage: '/images/collection-lumen-edit.jpg',
      accentHex: '#B08D57',
      featured: true,
      sortOrder: 1,
      active: true,
    },
  });

  await prisma.collection.create({
    data: {
      slug: 'new-arrivals',
      name: 'New Arrivals',
      kind: 'drop',
      tagline: 'Just landed',
      description: 'The latest drops from our design studio.',
      featured: false,
      sortOrder: 2,
      active: true,
    },
  });

  // Tags
  const tagSlugs = ['linen', 'cotton', 'silk', 'wool', 'cashmere', 'sustainable', 'minimalist', 'statement', 'workwear', 'evening'];
  const tagNames = ['Linen', 'Cotton', 'Silk', 'Wool', 'Cashmere', 'Sustainable', 'Minimalist', 'Statement', 'Workwear', 'Evening'];
  const tagKinds = ['fabric', 'fabric', 'fabric', 'fabric', 'fabric', 'trend', 'style', 'style', 'occasion', 'occasion'];

  for (let i = 0; i < tagSlugs.length; i++) {
    await prisma.tag.upsert({
      where: { slug: tagSlugs[i] },
      update: {},
      create: { slug: tagSlugs[i], name: tagNames[i], kind: tagKinds[i] },
    });
  }

  // Size Guides
  await prisma.sizeGuide.create({
    data: {
      name: 'Women\'s Tops',
      categoryId: womenCategory.id,
      unit: 'cm',
      columnsJson: '["Size","Bust","Waist","Hip","Length"]',
      rowsJson: '[["XS","82","64","90","58"],["S","86","68","94","59"],["M","90","72","98","60"],["L","96","78","104","61"],["XL","102","84","110","62"]]',
      notes: 'Measure over undergarments. Length measured from shoulder.',
    },
  });

  await prisma.sizeGuide.create({
    data: {
      name: 'Men\'s Shirts',
      categoryId: menCategory.id,
      unit: 'cm',
      columnsJson: '["Size","Chest","Waist","Neck","Sleeve","Length"]',
      rowsJson: '[["S","92","82","38","62","74"],["M","98","88","39","63","75"],["L","104","94","41","64","76"],["XL","110","100","42","65","77"],["XXL","116","106","43","66","78"]]',
      notes: 'Chest measured at fullest part. Sleeve from center back.',
    },
  });

  // Pincodes (sample for major Indian cities)
  const pincodes = [
    { pincode: '110001', city: 'New Delhi', state: 'Delhi', stateCode: '07', zone: 'metro', deliveryDays: 2, expressAvailable: true },
    { pincode: '400001', city: 'Mumbai', state: 'Maharashtra', stateCode: '27', zone: 'metro', deliveryDays: 2, expressAvailable: true },
    { pincode: '560001', city: 'Bangalore', state: 'Karnataka', stateCode: '29', zone: 'metro', deliveryDays: 2, expressAvailable: true },
    { pincode: '600001', city: 'Chennai', state: 'Tamil Nadu', stateCode: '33', zone: 'metro', deliveryDays: 3, expressAvailable: true },
    { pincode: '500001', city: 'Hyderabad', state: 'Telangana', stateCode: '36', zone: 'metro', deliveryDays: 3, expressAvailable: true },
    { pincode: '700001', city: 'Kolkata', state: 'West Bengal', stateCode: '19', zone: 'metro', deliveryDays: 3, expressAvailable: true },
    { pincode: '380001', city: 'Ahmedabad', state: 'Gujarat', stateCode: '24', zone: 'tier1', deliveryDays: 3 },
    { pincode: '411001', city: 'Pune', state: 'Maharashtra', stateCode: '27', zone: 'tier1', deliveryDays: 3 },
  ];

  for (const pc of pincodes) {
    await prisma.pincode.create({
      data: {
        ...pc,
        codAvailable: true,
        codLimit: 500000,
        returnAvailable: true,
        prepaidAvailable: true,
        active: true,
      },
    });
  }

  // Referral Rules
  const referralRule = await prisma.referralRule.create({
    data: {
      name: 'Standard Referral',
      active: true,
      kind: 'flat',
      value: 20000, // ₹200 in paise
      minOrderValue: 100000, // ₹1000
      firstOrderOnly: true,
      holdDays: 14,
      refereeCouponCode: 'WELCOME200',
      priority: 10,
    },
  });

  await prisma.referralTier.createMany({
    data: [
      { ruleId: referralRule.id, name: 'Bronze Referrer', minConversions: 5, bonusKind: 'percent', bonusValue: 10, badgeHex: '#CD7F32', sortOrder: 1 },
      { ruleId: referralRule.id, name: 'Silver Referrer', minConversions: 15, bonusKind: 'percent', bonusValue: 20, badgeHex: '#C0C0C0', sortOrder: 2 },
      { ruleId: referralRule.id, name: 'Gold Referrer', minConversions: 50, bonusKind: 'percent', bonusValue: 30, badgeHex: '#FFD700', sortOrder: 3 },
    ],
  });

  // Coupons
  await prisma.coupon.createMany({
    data: [
      { code: 'WELCOME200', name: 'Welcome ₹200 Off', kind: 'flat', value: 20000, minCartValue: 100000, firstOrderOnly: true, active: true, isReferralWelcome: true },
      { code: 'WELCOME10', name: 'Welcome 10% Off', kind: 'percent', value: 10, maxDiscount: 100000, minCartValue: 50000, firstOrderOnly: true, active: true },
      { code: 'FREESHIP', name: 'Free Shipping', kind: 'free_shipping', value: 0, active: true },
      { code: 'SAVE15', name: 'Save 15%', kind: 'percent', value: 15, maxDiscount: 200000, minCartValue: 200000, active: true },
    ],
  });

  // EMI Plans
  await prisma.emiPlan.createMany({
    data: [
      { bank: 'HDFC Bank', bankLogo: '/images/banks/hdfc.png', tenureMonths: 3, interestRate: 0, minAmount: 500000, noCostEmi: true, kind: 'emi', active: true, sortOrder: 1 },
      { bank: 'HDFC Bank', bankLogo: '/images/banks/hdfc.png', tenureMonths: 6, interestRate: 0, minAmount: 500000, noCostEmi: true, kind: 'emi', active: true, sortOrder: 2 },
      { bank: 'ICICI Bank', bankLogo: '/images/banks/icici.png', tenureMonths: 3, interestRate: 0, minAmount: 500000, noCostEmi: true, kind: 'emi', active: true, sortOrder: 3 },
      { bank: 'ICICI Bank', bankLogo: '/images/banks/icici.png', tenureMonths: 6, interestRate: 0, minAmount: 500000, noCostEmi: true, kind: 'emi', active: true, sortOrder: 4 },
      { bank: 'SBI', bankLogo: '/images/banks/sbi.png', tenureMonths: 3, interestRate: 0, minAmount: 500000, noCostEmi: true, kind: 'emi', active: true, sortOrder: 5 },
      { bank: 'Axis Bank', bankLogo: '/images/banks/axis.png', tenureMonths: 3, interestRate: 0, minAmount: 500000, noCostEmi: true, kind: 'emi', active: true, sortOrder: 6 },
      { bank: 'Bajaj Finserv', bankLogo: '/images/banks/bajaj.png', tenureMonths: 3, interestRate: 0, minAmount: 300000, noCostEmi: true, kind: 'bnpl', active: true, sortOrder: 7 },
    ],
  });

  // Products
  const productsData = [
    {
      slug: 'linen-oversized-shirt',
      name: 'Linen Oversized Shirt',
      subtitle: 'Breathable comfort meets relaxed tailoring',
      description: 'Crafted from 100% European linen, this oversized shirt features a relaxed silhouette with dropped shoulders and a curved hem. The natural texture of linen improves with every wash, developing a unique patina over time. Perfect for layering or wearing on its own.',
      story: 'Our linen is sourced from Flanders, Belgium — the historic heart of linen production. The fibers are harvested by hand, ensuring only the longest staples are used. This results in a fabric that is remarkably strong yet incredibly soft, with a natural cooling property that makes it ideal for the Indian climate.',
      careJson: '["Machine wash cold on gentle cycle","Do not bleach","Tumble dry low or line dry","Iron on medium heat while slightly damp","Store folded to prevent stretching"]',
      basePrice: 490000, // ₹4,900
      compareAtPrice: 650000,
      fabric: '100% European Linen (180 GSM)',
      occasion: 'casual',
      fit: 'oversized',
      gender: 'unisex',
      hsnCode: '6205',
      gstRate: 5,
      status: 'active',
      featured: true,
      categoryId: unisexCategory.id,
      images: [
        { url: '/images/product-linen-shirt.jpg', alt: 'Linen Oversized Shirt - Natural', kind: 'gallery', colorKey: 'natural', sortOrder: 1 },
        { url: '/images/product-linen-detail.jpg', alt: 'Linen Oversized Shirt - Detail', kind: 'gallery', colorKey: 'natural', sortOrder: 2 },
        { url: '/images/product-shirt-worn.jpg', alt: 'Linen Oversized Shirt - Worn', kind: 'gallery', colorKey: 'natural', sortOrder: 3 },
      ],
      variants: [
        { size: 'XS', color: 'Natural', colorHex: '#F5F0E1', priceDelta: 0, stock: 25, weightGrams: 280 },
        { size: 'S', color: 'Natural', colorHex: '#F5F0E1', priceDelta: 0, stock: 30, weightGrams: 290 },
        { size: 'M', color: 'Natural', colorHex: '#F5F0E1', priceDelta: 0, stock: 35, weightGrams: 300 },
        { size: 'L', color: 'Natural', colorHex: '#F5F0E1', priceDelta: 0, stock: 30, weightGrams: 310 },
        { size: 'XL', color: 'Natural', colorHex: '#F5F0E1', priceDelta: 0, stock: 20, weightGrams: 320 },
        { size: 'XS', color: 'Charcoal', colorHex: '#333333', priceDelta: 0, stock: 20, weightGrams: 280 },
        { size: 'S', color: 'Charcoal', colorHex: '#333333', priceDelta: 0, stock: 25, weightGrams: 290 },
        { size: 'M', color: 'Charcoal', colorHex: '#333333', priceDelta: 0, stock: 30, weightGrams: 300 },
        { size: 'L', color: 'Charcoal', colorHex: '#333333', priceDelta: 0, stock: 25, weightGrams: 310 },
        { size: 'XL', color: 'Charcoal', colorHex: '#333333', priceDelta: 0, stock: 15, weightGrams: 320 },
        { size: 'XS', color: 'Sage', colorHex: '#8A9A7B', priceDelta: 0, stock: 15, weightGrams: 280 },
        { size: 'S', color: 'Sage', colorHex: '#8A9A7B', priceDelta: 0, stock: 20, weightGrams: 290 },
        { size: 'M', color: 'Sage', colorHex: '#8A9A7B', priceDelta: 0, stock: 25, weightGrams: 300 },
        { size: 'L', color: 'Sage', colorHex: '#8A9A7B', priceDelta: 0, stock: 20, weightGrams: 310 },
        { size: 'XL', color: 'Sage', colorHex: '#8A9A7B', priceDelta: 0, stock: 10, weightGrams: 320 },
      ],
      tags: ['linen', 'sustainable', 'minimalist', 'workwear'],
      collections: [lumenEdit.id],
    },
    {
      slug: 'silk-blend-mandarin-shirt',
      name: 'Silk Blend Mandarin Shirt',
      subtitle: 'Luminous drape with a refined collar',
      description: 'A modern take on the classic mandarin collar shirt. The silk-cotton blend offers a subtle sheen and exceptional drape, while the concealed placket maintains a clean, minimalist aesthetic. French seams throughout for durability.',
      careJson: '["Dry clean recommended","Hand wash cold with mild detergent if needed","Do not wring or twist","Iron on low heat inside out","Store on padded hanger"]',
      basePrice: 720000, // ₹7,200
      compareAtPrice: 950000,
      fabric: '55% Silk, 45% Cotton (120 GSM)',
      occasion: 'formal',
      fit: 'regular',
      gender: 'men',
      hsnCode: '6205',
      gstRate: 5,
      status: 'active',
      featured: true,
      categoryId: menCategory.id,
      images: [
        { url: '/images/product-silk-shirt.jpg', alt: 'Silk Blend Mandarin Shirt - Ivory', kind: 'gallery', colorKey: 'ivory', sortOrder: 1 },
        { url: '/images/product-shirt-worn.jpg', alt: 'Silk Blend Mandarin Shirt - Detail', kind: 'gallery', colorKey: 'ivory', sortOrder: 2 },
      ],
      variants: [
        { size: 'S', color: 'Ivory', colorHex: '#FFFFF0', priceDelta: 0, stock: 15, weightGrams: 220 },
        { size: 'M', color: 'Ivory', colorHex: '#FFFFF0', priceDelta: 0, stock: 20, weightGrams: 230 },
        { size: 'L', color: 'Ivory', colorHex: '#FFFFF0', priceDelta: 0, stock: 18, weightGrams: 240 },
        { size: 'XL', color: 'Ivory', colorHex: '#FFFFF0', priceDelta: 0, stock: 12, weightGrams: 250 },
        { size: 'S', color: 'Midnight', colorHex: '#191970', priceDelta: 0, stock: 12, weightGrams: 220 },
        { size: 'M', color: 'Midnight', colorHex: '#191970', priceDelta: 0, stock: 18, weightGrams: 230 },
        { size: 'L', color: 'Midnight', colorHex: '#191970', priceDelta: 0, stock: 15, weightGrams: 240 },
        { size: 'XL', color: 'Midnight', colorHex: '#191970', priceDelta: 0, stock: 10, weightGrams: 250 },
      ],
      tags: ['silk', 'formal', 'minimalist', 'evening'],
      collections: [lumenEdit.id],
    },
    {
      slug: 'cotton-poplin-wrap-dress',
      name: 'Cotton Poplin Wrap Dress',
      subtitle: 'Effortless elegance with a flattering tie waist',
      description: 'This wrap dress is cut from crisp cotton poplin that holds its structure while remaining breathable. The true wrap design allows for a customizable fit, while the midi length and subtle A-line skirt create a universally flattering silhouette. Pockets included.',
      careJson: '["Machine wash cold with like colors","Do not bleach","Tumble dry low","Iron on medium heat","Wrap tie can be removed for washing"]',
      basePrice: 680000, // ₹6,800
      compareAtPrice: 880000,
      fabric: '100% Organic Cotton Poplin (110 GSM)',
      occasion: 'casual',
      fit: 'regular',
      gender: 'women',
      hsnCode: '6204',
      gstRate: 5,
      status: 'active',
      featured: true,
      categoryId: womenCategory.id,
      images: [
        { url: '/images/product-wrap-dress.jpg', alt: 'Cotton Poplin Wrap Dress - White', kind: 'gallery', colorKey: 'white', sortOrder: 1 },
        { url: '/images/product-dress-back.jpg', alt: 'Cotton Poplin Wrap Dress - Back', kind: 'gallery', colorKey: 'white', sortOrder: 2 },
      ],
      variants: [
        { size: 'XS', color: 'White', colorHex: '#FFFFFF', priceDelta: 0, stock: 18, weightGrams: 320 },
        { size: 'S', color: 'White', colorHex: '#FFFFFF', priceDelta: 0, stock: 22, weightGrams: 330 },
        { size: 'M', color: 'White', colorHex: '#FFFFFF', priceDelta: 0, stock: 20, weightGrams: 340 },
        { size: 'L', color: 'White', colorHex: '#FFFFFF', priceDelta: 0, stock: 15, weightGrams: 350 },
        { size: 'XL', color: 'White', colorHex: '#FFFFFF', priceDelta: 0, stock: 10, weightGrams: 360 },
        { size: 'XS', color: 'Navy', colorHex: '#1B2A4A', priceDelta: 0, stock: 15, weightGrams: 320 },
        { size: 'S', color: 'Navy', colorHex: '#1B2A4A', priceDelta: 0, stock: 20, weightGrams: 330 },
        { size: 'M', color: 'Navy', colorHex: '#1B2A4A', priceDelta: 0, stock: 18, weightGrams: 340 },
        { size: 'L', color: 'Navy', colorHex: '#1B2A4A', priceDelta: 0, stock: 12, weightGrams: 350 },
        { size: 'XL', color: 'Navy', colorHex: '#1B2A4A', priceDelta: 0, stock: 8, weightGrams: 360 },
      ],
      tags: ['cotton', 'sustainable', 'workwear', 'statement'],
      collections: [lumenEdit.id],
    },
    {
      slug: 'merino-wool-crew-neck',
      name: 'Merino Wool Crew Neck',
      subtitle: 'Temperature-regulating luxury for every season',
      description: 'Knitted from 18.5 micron merino wool, this crew neck offers exceptional softness without the itch. The natural thermoregulating properties keep you warm in winter and cool in summer. Odor-resistant and moisture-wicking, it\'s the ultimate travel companion.',
      careJson: '["Hand wash cold or dry clean","Lay flat to dry","Do not hang wet","Store folded with cedar blocks","Pilling is natural — use a fabric shaver"]',
      basePrice: 550000, // ₹5,500
      compareAtPrice: 720000,
      fabric: '100% Merino Wool (18.5 micron, 220 GSM)',
      occasion: 'casual',
      fit: 'relaxed',
      gender: 'unisex',
      hsnCode: '6110',
      gstRate: 5,
      status: 'active',
      featured: false,
      categoryId: unisexCategory.id,
      images: [
        { url: '/images/product-merino-wool.jpg', alt: 'Merino Wool Crew Neck - Oatmeal', kind: 'gallery', colorKey: 'oatmeal', sortOrder: 1 },
      ],
      variants: [
        { size: 'XS', color: 'Oatmeal', colorHex: '#D9D2C4', priceDelta: 0, stock: 20, weightGrams: 280 },
        { size: 'S', color: 'Oatmeal', colorHex: '#D9D2C4', priceDelta: 0, stock: 25, weightGrams: 290 },
        { size: 'M', color: 'Oatmeal', colorHex: '#D9D2C4', priceDelta: 0, stock: 30, weightGrams: 300 },
        { size: 'L', color: 'Oatmeal', colorHex: '#D9D2C4', priceDelta: 0, stock: 25, weightGrams: 310 },
        { size: 'XL', color: 'Oatmeal', colorHex: '#D9D2C4', priceDelta: 0, stock: 15, weightGrams: 320 },
        { size: 'XS', color: 'Charcoal', colorHex: '#333333', priceDelta: 0, stock: 18, weightGrams: 280 },
        { size: 'S', color: 'Charcoal', colorHex: '#333333', priceDelta: 0, stock: 22, weightGrams: 290 },
        { size: 'M', color: 'Charcoal', colorHex: '#333333', priceDelta: 0, stock: 28, weightGrams: 300 },
        { size: 'L', color: 'Charcoal', colorHex: '#333333', priceDelta: 0, stock: 20, weightGrams: 310 },
        { size: 'XL', color: 'Charcoal', colorHex: '#333333', priceDelta: 0, stock: 12, weightGrams: 320 },
      ],
      tags: ['wool', 'sustainable', 'minimalist', 'workwear'],
      collections: [lumenEdit.id],
    },
    {
      slug: 'cashmere-blend-scarf',
      name: 'Cashmere Blend Scarf',
      subtitle: 'Cloud-soft warmth in a generous drape',
      description: 'Woven from a premium cashmere-wool blend, this oversized scarf offers the luxurious hand-feel of cashmere with improved durability. The generous dimensions allow for multiple styling options — draped, wrapped, or knotted.',
      careJson: '["Dry clean only","Store flat in breathable bag","Avoid contact with rough surfaces","Steam to refresh between wears"]',
      basePrice: 850000, // ₹8,500
      compareAtPrice: 1100000,
      fabric: '30% Cashmere, 70% Merino Wool (180 GSM)',
      occasion: 'formal',
      fit: 'oversized',
      gender: 'unisex',
      hsnCode: '6214',
      gstRate: 5,
      status: 'active',
      featured: true,
      categoryId: unisexCategory.id,
      images: [
        { url: '/images/product-cashmere-scarf.jpg', alt: 'Cashmere Blend Scarf - Camel', kind: 'gallery', colorKey: 'camel', sortOrder: 1 },
      ],
      variants: [
        { size: 'OS', color: 'Camel', colorHex: '#C19A6B', priceDelta: 0, stock: 25, weightGrams: 180 },
        { size: 'OS', color: 'Charcoal', colorHex: '#333333', priceDelta: 0, stock: 20, weightGrams: 180 },
        { size: 'OS', color: 'Ivory', colorHex: '#FFFFF0', priceDelta: 0, stock: 15, weightGrams: 180 },
      ],
      tags: ['cashmere', 'wool', 'statement', 'evening'],
      collections: [lumenEdit.id],
    },
  ];

  // Ensure all tags exist before creating products
  const allTagSlugs = new Set<string>();
  for (const p of productsData) {
    p.tags.forEach(slug => allTagSlugs.add(slug));
  }
  for (const slug of allTagSlugs) {
    await prisma.tag.upsert({
      where: { slug },
      update: {},
      create: { slug, name: slug.charAt(0).toUpperCase() + slug.slice(1), kind: 'style' },
    });
  }

  for (const p of productsData) {
    const { images, variants, tags: tagSlugs, collections: collectionIds, ...productData } = p;
    const product = await prisma.product.create({
      data: {
        ...productData,
        images: { create: images },
        variants: { create: variants.map(v => ({ ...v, sku: `${p.slug.toUpperCase()}-${v.size}-${v.color.toUpperCase().slice(0,3)}` })) },
        tags: { create: tagSlugs.map(slug => ({ tag: { connect: { slug } } })) },
        collections: { create: collectionIds.map(collectionId => ({ collectionId })) },
      },
    });
    console.log(`Created product: ${product.name}`);
  }

  // Create a test user
  const testUser = await prisma.user.create({
    data: {
      email: 'test@lumenandco.example',
      phone: '+919876543210',
      passwordHash: await hashPassword('Test@12345'),
      name: 'Test Customer',
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      gender: 'unisex',
      referralCode: await generateReferralCode('Test Customer'),
      loyaltyTier: 'bronze',
      loyaltyPoints: 500,
    },
  });

  // Create wallet for test user
  await prisma.wallet.create({
    data: {
      userId: testUser.id,
      balance: 100000,
      lockedBalance: 0,
      totalEarned: 100000,
      totalWithdrawn: 0,
    },
  });

  // Create sample addresses
  await prisma.address.create({
    data: {
      userId: testUser.id,
      label: 'home',
      name: 'Test Customer',
      phone: '+919876543210',
      line1: '123 MG Road',
      line2: 'Near Metro Station',
      city: 'Bangalore',
      state: 'Karnataka',
      stateCode: '29',
      pincode: '560001',
      country: 'IN',
      isDefault: true,
    },
  });

  console.log('✅ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });