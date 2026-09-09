import Link from 'next/link';
import { db } from '@/lib/db';
import { Plus, GripVertical, Edit, Trash2, Eye } from 'lucide-react';
import { SmartImage } from '@/components/ui/SmartImage';

export const dynamic = 'force-dynamic';

export default async function AdminCollectionsPage() {
  const collections = await db.collection.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { products: true } },
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>Collections</h1>
          <p className="text-[13px] text-[#7A7468] mt-0.5">Curate products for storefront display</p>
        </div>
        <Link
          href="/admin/collections/new"
          className="flex items-center justify-center gap-1.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white px-4 py-2 rounded-lg text-[12px] font-medium transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Collection
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[#E8E5DE] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[#FAF9F7] text-[#7A7468] uppercase text-[10px] tracking-wider border-b border-[#E8E5DE]">
              <tr>
                <th className="px-5 py-3 w-10 font-medium"></th>
                <th className="px-5 py-3 font-medium">Collection</th>
                <th className="px-5 py-3 font-medium">Slug</th>
                <th className="px-5 py-3 font-medium">Products</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Featured</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F1ED]">
              {collections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-[#9E9789]">
                    No collections yet. Click "Create Collection" to start.
                  </td>
                </tr>
              ) : (
                collections.map((collection) => (
                  <tr key={collection.id} className="hover:bg-[#FAF9F7] transition-colors">
                    <td className="px-5 py-3">
                      <GripVertical className="w-3.5 h-3.5 text-[#E8E5DE] cursor-grab mx-auto" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {collection.heroImage && (
                          <div className="relative w-9 h-9 rounded-md overflow-hidden bg-[#F3F1ED] shrink-0">
                            <SmartImage src={collection.heroImage} alt={collection.name} fill sizes="36px" className="object-cover" />
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-[#0A0A0A] block text-[13px]">{collection.name}</span>
                          {collection.description && (
                            <span className="text-[10px] text-[#9E9789] line-clamp-1">{collection.description}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-[#7A7468] text-[11px]">/{collection.slug}</td>
                    <td className="px-5 py-3 font-medium text-[#0A0A0A]">{collection._count.products}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        collection.active
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-[#F3F1ED] text-[#7A7468] border border-[#E8E5DE]'
                      }`}>
                        {collection.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        collection.featured
                          ? 'bg-[#D4A853]/10 text-[#9C7C4E] border border-[#D4A853]/20'
                          : 'bg-[#F3F1ED] text-[#7A7468] border border-[#E8E5DE]'
                      }`}>
                        {collection.featured ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/collections/${collection.slug}`}
                          target="_blank"
                          className="p-1.5 text-[#7A7468] hover:text-[#9C7C4E] hover:bg-[#F3F1ED] rounded-md transition-colors"
                          title="View"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          href={`/admin/collections/${collection.id}/edit`}
                          className="p-1.5 text-[#7A7468] hover:text-[#9C7C4E] hover:bg-[#F3F1ED] rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
