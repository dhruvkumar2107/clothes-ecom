import { db } from '@/lib/db';
import { ProductForm } from '@/components/admin/ProductForm';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const categories = await db.category.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="pb-6 border-b border-zinc-800/80">
        <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Create New Product</h1>
        <p className="text-xs text-zinc-400 mt-1">Add a new luxury garment to your active catalogue.</p>
      </div>

      <ProductForm categories={categories} />
    </div>
  );
}
