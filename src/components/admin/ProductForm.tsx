'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, Trash2, ArrowLeft, Loader2, Sparkles } from 'lucide-react';

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

interface VariantInput {
  size: string;
  color: string;
  colorHex: string;
  stock: string;
}

interface FormData {
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  story: string;
  basePrice: string;
  compareAtPrice: string;
  fabric: string;
  occasion: string;
  fit: string;
  gender: string;
  categoryId: string;
  imageUrl: string;
}

interface ProductFormProps {
  categories: CategoryOption[];
  initialData?: Partial<FormData>;
  initialVariants?: VariantInput[];
  productId?: string;
  isEdit?: boolean;
}

export function ProductForm({
  categories,
  initialData = {},
  initialVariants = [],
  productId,
  isEdit = false,
}: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<FormData>({
    name: '',
    slug: '',
    subtitle: '',
    description: '',
    story: '',
    basePrice: '',
    compareAtPrice: '',
    fabric: '100% Organic Cotton',
    occasion: 'casual',
    fit: 'regular',
    gender: 'unisex',
    categoryId: categories[0]?.id || '',
    imageUrl: '/images/product-linen-shirt.jpg',
    ...initialData,
  });

  const [variants, setVariants] = useState<VariantInput[]>(
    initialVariants.length > 0
      ? initialVariants
      : [
          { size: 'S', color: 'Natural', colorHex: '#F5F0E1', stock: '20' },
          { size: 'M', color: 'Natural', colorHex: '#F5F0E1', stock: '30' },
          { size: 'L', color: 'Natural', colorHex: '#F5F0E1', stock: '25' },
        ]
  );

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    setFormData((prev) => ({ ...prev, name, slug }));
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, { size: 'M', color: 'Grey', colorHex: '#808080', stock: '15' }]);
  };

  const removeVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: string, value: string) => {
    setVariants((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = isEdit && productId ? `/api/admin/products/${productId}` : '/api/admin/products';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, variants }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save product.');

      router.push('/admin/products');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 text-xs text-zinc-200">
      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 font-medium">
          {error}
        </div>
      )}

      {/* Basic Details */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" /> General Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Product Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Belgian Linen Oversized Shirt"
              value={formData.name}
              onChange={handleNameChange}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">URL Slug *</label>
            <input
              type="text"
              required
              placeholder="belgian-linen-oversized-shirt"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-mono focus:border-amber-500/60 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Subtitle / Tagline</label>
          <input
            type="text"
            placeholder="Breathable comfort meets relaxed tailoring"
            value={formData.subtitle}
            onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:border-amber-500/60 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Category *</label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:border-amber-500/60 focus:outline-none"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Fabric & Composition</label>
            <input
              type="text"
              placeholder="100% European Linen (180 GSM)"
              value={formData.fabric}
              onChange={(e) => setFormData({ ...formData, fabric: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:border-amber-500/60 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Pricing & Attributes */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-zinc-100">Pricing & Attributes</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Base Price (₹) *</label>
            <input
              type="number"
              step="1"
              required
              placeholder="4900"
              value={formData.basePrice}
              onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-mono focus:border-amber-500/60 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Compare At Price (₹)</label>
            <input
              type="number"
              step="1"
              placeholder="6500"
              value={formData.compareAtPrice}
              onChange={(e) => setFormData({ ...formData, compareAtPrice: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-mono focus:border-amber-500/60 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Gender Target</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:border-amber-500/60 focus:outline-none"
            >
              <option value="unisex">Unisex</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Fit Silhouette</label>
            <select
              value={formData.fit}
              onChange={(e) => setFormData({ ...formData, fit: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:border-amber-500/60 focus:outline-none"
            >
              <option value="regular">Regular</option>
              <option value="oversized">Oversized</option>
              <option value="slim">Slim</option>
              <option value="relaxed">Relaxed</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Occasion</label>
            <select
              value={formData.occasion}
              onChange={(e) => setFormData({ ...formData, occasion: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:border-amber-500/60 focus:outline-none"
            >
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
              <option value="evening">Evening</option>
              <option value="festive">Festive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Description & Imagery */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-zinc-100">Media & Editorial Description</h2>

        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Primary Image URL</label>
          <input
            type="url"
            required
            placeholder="/images/product-..."
            value={formData.imageUrl}
            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 font-mono focus:border-amber-500/60 focus:outline-none"
          />

          {formData.imageUrl && (
            <div className="mt-3 flex items-center gap-3">
              <div className="relative w-16 h-20 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
                <Image src={formData.imageUrl} alt="Preview" fill className="object-cover" unoptimized />
              </div>
              <span className="text-[11px] text-emerald-400">Live preview loaded</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-medium text-zinc-400 mb-1.5">Product Description</label>
          <textarea
            rows={3}
            placeholder="Crafted from 100% European linen..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:border-amber-500/60 focus:outline-none"
          />
        </div>
      </div>

      {/* Variant Builder */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Inventory Variants</h2>
          <button
            type="button"
            onClick={addVariant}
            className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add Variant
          </button>
        </div>

        <div className="space-y-3">
          {variants.map((variant, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
              <div className="w-24">
                <label className="block text-[10px] text-zinc-500 mb-1">Size</label>
                <input
                  type="text"
                  value={variant.size}
                  onChange={(e) => updateVariant(idx, 'size', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                />
              </div>

              <div className="flex-1">
                <label className="block text-[10px] text-zinc-500 mb-1">Color Name</label>
                <input
                  type="text"
                  value={variant.color}
                  onChange={(e) => updateVariant(idx, 'color', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200"
                />
              </div>

              <div className="w-24">
                <label className="block text-[10px] text-zinc-500 mb-1">Stock Qty</label>
                <input
                  type="number"
                  value={variant.stock}
                  onChange={(e) => updateVariant(idx, 'stock', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200 font-mono"
                />
              </div>

              {variants.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVariant(idx)}
                  className="p-2 text-zinc-500 hover:text-rose-400 transition-colors self-end"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 font-medium transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-amber-500/10 transition-all"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Update Product' : 'Publish Product'}
        </button>
      </div>
    </form>
  );
}