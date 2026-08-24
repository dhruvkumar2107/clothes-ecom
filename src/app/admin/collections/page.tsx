import Link from 'next/link';
import { PrismaClient } from '@prisma/client';
import { Plus, Layers, GripVertical, Edit, Trash2, Eye, Shield } from 'lucide-react';

const prisma = new PrismaClient();

export const revalidate = 0;

export default async function AdminCollectionsPage() {
  const collections = await prisma.collection.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { products: true } },
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Collections</h1>
          <p className="text-xs text-zinc-400 mt-1">Organize products into curated collections for storefront display.</p>
        </div>
        <Link
          href="/admin/collections/new"
          className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-lg text-xs font-semibold shadow-md shadow-amber-500/10 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Collection
        </Link>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 w-10">Sort</th>
                <th className="px-6 py-4">Collection</th>
                <th className="px-6 py-4">Slug</th>
                <th className="px-6 py-4">Products</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Featured</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {collections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    No collections created yet. Click "Create Collection" to start.
                  </td>
                </tr>
              ) : (
                collections.map((collection) => (
                  <tr key={collection.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <GripVertical className="w-4 h-4 text-zinc-500 cursor-grab hover:text-amber-400 mx-auto" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {collection.heroImage && (
                          <div className="relative w-10 h-10 rounded-md overflow-hidden bg-zinc-800 border border-zinc-700/60 shrink-0">
                            <img
                              src={collection.heroImage}
                              alt={collection.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div>
                          <span className="font-semibold text-zinc-100 block text-sm">{collection.name}</span>
                          {collection.description && (
                            <span className="text-[10px] text-zinc-400 line-clamp-1">{collection.description}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-400">
                      /{collection.slug}
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-zinc-200">
                      {collection._count.products}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          collection.active
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {collection.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          collection.featured
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {collection.featured ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/collections/${collection.slug}`}
                          target="_blank"
                          className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors"
                          title="View on Storefront"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/admin/collections/${collection.id}/edit`}
                          className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded transition-colors"
                          title="Edit Collection"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors" title="Delete Collection">
                          <Trash2 className="w-4 h-4" />
                        </button>
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