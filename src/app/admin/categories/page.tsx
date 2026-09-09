import Link from 'next/link';
import { db } from '@/lib/db';
import { Plus, Edit, Eye, ChevronRight, FolderTree } from 'lucide-react';
import { SmartImage } from '@/components/ui/SmartImage';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      children: {
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { products: true } } },
      },
      _count: { select: { products: true } },
    },
    where: { parentId: null },
  });

  const totalProducts = await db.product.count({ where: { status: 'active' } });

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>Categories</h1>
          <p className="text-[12px] text-[#7A7468] mt-0.5">{categories.length} top-level categories · {totalProducts} active products</p>
        </div>
        <Link href="/admin/products/new" className="flex items-center gap-1.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors">
          <Plus className="w-3 h-3" /> Add Category
        </Link>
      </div>

      {/* Categories Tree */}
      <div className="space-y-3">
        {categories.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8E5DE] p-12 text-center text-[#9E9789] text-[12px]">No categories found.</div>
        ) : categories.map((cat) => (
          <div key={cat.id} className="bg-white rounded-xl border border-[#E8E5DE] overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <div className="w-12 h-12 rounded-lg bg-[#F3F1ED] flex items-center justify-center shrink-0">
                {cat.heroImage ? (
                  <SmartImage src={cat.heroImage} alt="" width={48} height={48} className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <FolderTree className="w-5 h-5 text-[#9C7C4E]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] font-semibold text-[#0A0A0A]">{cat.name}</h3>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                    cat.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-[#F3F1ED] text-[#7A7468] border border-[#E8E5DE]'
                  }`}>{cat.active ? 'Active' : 'Inactive'}</span>
                </div>
                <p className="text-[11px] text-[#7A7468] mt-0.5">/{cat.slug}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-[#9E9789]">{cat._count.products} products</span>
                  {cat.children.length > 0 && <span className="text-[10px] text-[#9E9789]">{cat.children.length} subcategories</span>}
                </div>
              </div>
              <Link href={`/admin/products?category=${cat.slug}`} className="p-1.5 text-[#7A7468] hover:text-[#9C7C4E] hover:bg-[#F3F1ED] rounded-md transition-colors" title="View Products">
                <Eye className="w-3.5 h-3.5" />
              </Link>
            </div>
            {cat.children.length > 0 && (
              <div className="border-t border-[#F3F1ED] bg-[#FAF9F7]">
                {cat.children.map((child, i) => (
                  <div key={child.id} className={`flex items-center gap-3 px-4 py-2.5 ${i < cat.children.length - 1 ? 'border-b border-[#F3F1ED]' : ''}`}>
                    <ChevronRight className="w-3 h-3 text-[#E8E5DE]" />
                    <span className="text-[11px] font-medium text-[#0A0A0A]">{child.name}</span>
                    <span className="text-[9px] text-[#9E9789]">/{child.slug}</span>
                    <span className="text-[10px] text-[#7A7468] ml-auto">{child._count.products} products</span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                      child.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-[#F3F1ED] text-[#7A7468] border border-[#E8E5DE]'
                    }`}>{child.active ? 'Active' : 'Inactive'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
