import { db } from '@/lib/db';
import { ProductForm } from '@/components/admin/ProductForm';
import { notFound } from 'next/navigation';

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;

  const [product, categories, collections, productCollections] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: { sortOrder: 'asc' } },
        category: { select: { id: true, name: true, slug: true } },
      },
    }),
    db.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    db.collection.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, slug: true },
    }),
    db.productCollection.findMany({
      where: { productId: id },
      select: { collectionId: true },
    }),
  ]);

  if (!product) notFound();

  const formattedProduct = {
    name: product.name,
    slug: product.slug,
    subtitle: product.subtitle || '',
    description: product.description || '',
    story: product.story || '',
    basePrice: String(product.basePrice),
    compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : '',
    costPrice: product.costPrice ? String(product.costPrice) : '',
    fabric: product.fabric || '',
    occasion: product.occasion || 'casual',
    fit: product.fit || 'regular',
    gender: product.gender || 'unisex',
    categoryId: product.categoryId,
    imageUrl: product.images[0]?.url || '',
    collectionIds: productCollections.map(pc => pc.collectionId),
    tags: '',
    featured: product.featured,
    status: product.status,
  };

  const formattedVariants = product.variants.map((v) => ({
    size: v.size,
    color: v.color,
    colorHex: v.colorHex,
    stock: v.stock.toString(),
  }));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-lg font-semibold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>Edit Product</h1>
        <p className="text-[12px] text-[#7A7468] mt-0.5">Modify product details, pricing, variants, and imagery</p>
      </div>
      <ProductForm
        categories={categories}
        collections={collections}
        initialData={formattedProduct}
        initialVariants={formattedVariants}
        productId={id}
        isEdit={true}
      />
    </div>
  );
}
