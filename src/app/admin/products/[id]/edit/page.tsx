import { db } from '@/lib/db';
import { ProductForm } from '@/components/admin/ProductForm';
import { notFound } from 'next/navigation';

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;

  const [product, categories] = await Promise.all([
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
  ]);

  if (!product) {
    notFound();
  }

  const formattedProduct = {
    name: product.name,
    slug: product.slug,
    subtitle: product.subtitle || '',
    description: product.description || '',
    story: product.story || '',
    basePrice: (product.basePrice / 100).toFixed(2),
    compareAtPrice: product.compareAtPrice ? (product.compareAtPrice / 100).toFixed(2) : '',
    fabric: product.fabric || '',
    occasion: product.occasion || 'casual',
    fit: product.fit || 'regular',
    gender: product.gender || 'unisex',
    categoryId: product.categoryId,
    imageUrl: product.images[0]?.url || '',
  };

  const formattedVariants = product.variants.map((v) => ({
    size: v.size,
    color: v.color,
    colorHex: v.colorHex,
    stock: v.stock.toString(),
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-6 border-b border-zinc-800/80 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Edit Product</h1>
          <p className="text-xs text-zinc-400 mt-1">Modify product details, pricing, variants, and imagery.</p>
        </div>
      </div>

      <ProductForm
        categories={categories}
        initialData={formattedProduct}
        initialVariants={formattedVariants}
        productId={id}
        isEdit={true}
      />
    </div>
  );
}
