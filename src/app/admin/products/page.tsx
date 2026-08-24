import Link from 'next/link';
import Image from 'next/image';
import { PrismaClient } from '@prisma/client';
import { formatMoney } from '@/lib/money';
import { Plus, Package, Edit, ExternalLink, Search, Trash2 } from 'lucide-react';

const prisma = new PrismaClient();

export const revalidate = 0;

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      category: { select: { name: true } },
      images: { take: 1, orderBy: { sortOrder: 'asc' } },
      variants: { select: { stock: true } },
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Product Catalogue</h1>
          <p className="text-xs text-zinc-400 mt-1">Manage active listings, inventory levels, prices, and imagery.</p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-lg text-xs font-semibold shadow-md shadow-amber-500/10 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Link>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Base Price</th>
                <th className="px-6 py-4">Total Stock</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    No products added yet. Click &quot;Add Product&quot; to create your first listing.
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const mainImage = product.images[0]?.url || 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=400&q=80';
                  const totalStock = product.variants.reduce((acc, v) => acc + v.stock, 0);

                  return (
                    <tr key={product.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          <div className="relative w-12 h-14 rounded-md overflow-hidden bg-zinc-800 border border-zinc-700/60 shrink-0">
                            <Image
                              src={mainImage}
                              alt={product.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-100 block text-sm">{product.name}</span>
                            <span className="text-[11px] text-zinc-400 font-mono">/{product.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700/50 text-zinc-300 font-medium">
                          {product.category.name}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-zinc-100">
                        {formatMoney(product.basePrice)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`font-mono font-medium ${
                            totalStock === 0
                              ? 'text-rose-400 font-bold'
                              : totalStock < 10
                              ? 'text-amber-400'
                              : 'text-zinc-200'
                          }`}
                        >
                          {totalStock} units
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            product.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/products/${product.slug}`}
                            target="_blank"
                            className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors"
                            title="View on Storefront"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={e => {
                              e.preventDefault();
                              if (confirm('Are you sure you want to delete this product?')) {
                                fetch(`/api/admin/products/${product.id}`, {
                                  method: 'DELETE',
                                  headers: { 'Content-Type': 'application/json' },
                                }).then(() => {
                                  window.location.href = '/admin/products';
                                });
                              }
                            }}
                            className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors"
                            title="Delete Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
