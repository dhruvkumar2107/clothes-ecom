'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SmartImage } from '@/components/ui/SmartImage';
import { Plus, Trash2, ArrowLeft, ArrowRight, Loader2, Upload, X, Check, Layers, Package, Palette } from 'lucide-react';

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  children?: CategoryOption[];
}

interface CollectionOption {
  id: string;
  name: string;
  slug: string;
}

interface VariantInput {
  size: string;
  color: string;
  colorHex: string;
  stock: string;
  sku?: string;
}

interface FormData {
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  story: string;
  basePrice: string;
  compareAtPrice: string;
  costPrice: string;
  fabric: string;
  occasion: string;
  fit: string;
  gender: string;
  categoryId: string;
  imageUrl: string;
  collectionIds: string[];
  tags: string;
  featured: boolean;
  status: string;
}

interface ProductFormProps {
  categories: CategoryOption[];
  collections?: CollectionOption[];
  initialData?: Partial<FormData>;
  initialVariants?: VariantInput[];
  productId?: string;
  isEdit?: boolean;
}

const PRESET_COLORS = [
  { name: 'Black', hex: '#111111' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Navy', hex: '#1B2A4A' },
  { name: 'Charcoal', hex: '#333333' },
  { name: 'Cream', hex: '#FFFDD0' },
  { name: 'Natural', hex: '#F5F0E1' },
  { name: 'Sand', hex: '#C2B280' },
  { name: 'Olive', hex: '#556B2F' },
  { name: 'Ivory', hex: '#FFFFF0' },
  { name: 'Camel', hex: '#C19A6B' },
  { name: 'Sage', hex: '#8A9A7B' },
  { name: 'Terracotta', hex: '#C67D5B' },
  { name: 'Oatmeal', hex: '#D9D2C4' },
  { name: 'Khaki', hex: '#BDB76B' },
  { name: 'Midnight', hex: '#191970' },
  { name: 'Wine', hex: '#722F37' },
  { name: 'Blush', hex: '#DE929A' },
  { name: 'Indigo', hex: '#3F5D8C' },
];

const STEPS = [
  { id: 'basic', label: 'Basic Info', icon: Package },
  { id: 'pricing', label: 'Pricing', icon: Package },
  { id: 'media', label: 'Media', icon: Upload },
  { id: 'variants', label: 'Variants', icon: Palette },
  { id: 'organize', label: 'Organize', icon: Layers },
];

export function ProductForm({
  categories,
  collections = [],
  initialData = {},
  initialVariants = [],
  productId,
  isEdit = false,
}: ProductFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '', slug: '', subtitle: '', description: '', story: '',
    basePrice: '', compareAtPrice: '', costPrice: '',
    fabric: '100% Organic Cotton', occasion: 'casual', fit: 'regular', gender: 'unisex',
    categoryId: categories[0]?.id || '', imageUrl: '',
    collectionIds: [], tags: '', featured: false, status: 'active',
    ...initialData,
  });

  const [variants, setVariants] = useState<VariantInput[]>(
    initialVariants.length > 0 ? initialVariants : [
      { size: 'S', color: 'Black', colorHex: '#111111', stock: '20' },
      { size: 'M', color: 'Black', colorHex: '#111111', stock: '30' },
      { size: 'L', color: 'Black', colorHex: '#111111', stock: '25' },
    ]
  );

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slug = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    setFormData((prev) => ({ ...prev, name, slug }));
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5 MB.'); return; }
    setError('');
    setUploadProgress(0);
    const previewUrl = URL.createObjectURL(file);
    setFormData((prev) => ({ ...prev, imageUrl: previewUrl }));
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, folder: 'products' }),
      });
      if (!res.ok) throw new Error('Failed to get upload URL');
      const { data } = await res.json();
      const { uploadUrl, fileUrl } = data;
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100)); };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) { setFormData((prev) => ({ ...prev, imageUrl: fileUrl })); setUploadProgress(null); resolve(); }
          else reject(new Error('Upload failed'));
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(file);
      });
    } catch (err: any) { setUploadProgress(null); setError(err.message || 'Upload failed.'); }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file); };

  const addVariant = () => setVariants((prev) => [...prev, { size: 'M', color: 'Black', colorHex: '#111111', stock: '15' }]);
  const removeVariant = (index: number) => setVariants((prev) => prev.filter((_, i) => i !== index));
  const updateVariant = (index: number, field: string, value: string) => {
    setVariants((prev) => { const next = [...prev]; next[index] = { ...next[index], [field]: value }; return next; });
  };

  const toggleCollection = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      collectionIds: prev.collectionIds.includes(id) ? prev.collectionIds.filter(c => c !== id) : [...prev.collectionIds, id],
    }));
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
    } catch (err: any) { setError(err.message || 'Something went wrong.'); }
    finally { setLoading(false); }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Product Name *</label>
              <input type="text" required placeholder="e.g. Premium Oversized Cotton Tee" value={formData.name} onChange={handleNameChange}
                className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#7A7468] mb-1">URL Slug *</label>
              <input type="text" required placeholder="premium-oversized-cotton-tee" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] font-mono focus:border-[#9C7C4E]/50 focus:outline-none transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Subtitle</label>
            <input type="text" placeholder="Breathable comfort meets relaxed tailoring" value={formData.subtitle} onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Description</label>
            <textarea rows={3} placeholder="Crafted from 100% European linen..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors resize-y min-h-[80px]" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Story / Editorial</label>
            <textarea rows={2} placeholder="Long-form editorial content..." value={formData.story} onChange={(e) => setFormData({ ...formData, story: e.target.value })}
              className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors resize-y" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Category *</label>
              <select value={formData.categoryId} onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors">
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Gender</label>
              <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors">
                <option value="unisex">Unisex</option><option value="men">Men</option><option value="women">Women</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Fabric</label>
              <input type="text" placeholder="100% Organic Cotton" value={formData.fabric} onChange={(e) => setFormData({ ...formData, fabric: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Fit</label>
              <select value={formData.fit} onChange={(e) => setFormData({ ...formData, fit: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors">
                <option value="regular">Regular</option><option value="oversized">Oversized</option><option value="slim">Slim</option><option value="relaxed">Relaxed</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Occasion</label>
              <select value={formData.occasion} onChange={(e) => setFormData({ ...formData, occasion: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors">
                <option value="casual">Casual</option><option value="formal">Formal</option><option value="evening">Evening</option><option value="festive">Festive</option><option value="workwear">Workwear</option>
              </select>
            </div>
          </div>
        </div>
      );
      case 1: return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Base Price (INR) *</label>
              <input type="number" step="1" required placeholder="4900" value={formData.basePrice} onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] font-mono focus:border-[#9C7C4E]/50 focus:outline-none transition-colors" />
              <p className="text-[9px] text-[#9E9789] mt-1">Enter in rupees. Stored as paise internally.</p>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Compare At Price (INR)</label>
              <input type="number" step="1" placeholder="6500" value={formData.compareAtPrice} onChange={(e) => setFormData({ ...formData, compareAtPrice: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] font-mono focus:border-[#9C7C4E]/50 focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Cost Price (INR)</label>
              <input type="number" step="1" placeholder="2500" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] font-mono focus:border-[#9C7C4E]/50 focus:outline-none transition-colors" />
              <p className="text-[9px] text-[#9E9789] mt-1">Admin-only. Powers margin reporting.</p>
            </div>
          </div>
          {formData.basePrice && (
            <div className="bg-[#FAF9F7] rounded-lg border border-[#E8E5DE] p-3">
              <p className="text-[10px] text-[#7A7468]">Price Preview</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-lg font-bold text-[#0A0A0A]">₹{(parseInt(formData.basePrice) || 0).toLocaleString('en-IN')}</span>
                {formData.compareAtPrice && parseInt(formData.compareAtPrice) > parseInt(formData.basePrice) && (
                  <>
                    <span className="text-sm text-[#9E9789] line-through">₹{parseInt(formData.compareAtPrice).toLocaleString('en-IN')}</span>
                    <span className="text-[10px] font-semibold text-[#3D6B4D] bg-emerald-50 px-1.5 py-0.5 rounded">
                      {Math.round(((parseInt(formData.compareAtPrice) - parseInt(formData.basePrice)) / parseInt(formData.compareAtPrice)) * 100)}% OFF
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      );
      case 2: return (
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Product Image</label>
            <div onDragOver={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                dragActive ? 'border-[#9C7C4E] bg-[#9C7C4E]/5' : 'border-[#E8E5DE] hover:border-[#9C7C4E]/30 bg-[#FAF9F7]'
              }`}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file); }} className="hidden" />
              {formData.imageUrl && !uploadProgress ? (
                <div className="flex items-center gap-4 w-full">
                  <div className="relative w-20 h-24 rounded-lg overflow-hidden border border-[#E8E5DE] bg-white shrink-0">
                    <SmartImage src={formData.imageUrl} alt="Preview" fill className="object-cover" unoptimized />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-[#0A0A0A] truncate">{formData.imageUrl.split('/').pop()}</p>
                    <p className="text-[10px] text-[#3D6B4D] mt-1">Ready</p>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setFormData((prev) => ({ ...prev, imageUrl: '' })); }} className="p-1.5 text-[#9E9789] hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                </div>
              ) : uploadProgress !== null ? (
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-2"><Loader2 className="w-4 h-4 text-[#9C7C4E] animate-spin" /><span className="text-[12px] text-[#7A7468]">Uploading... {uploadProgress}%</span></div>
                  <div className="w-full h-1.5 bg-[#F3F1ED] rounded-full overflow-hidden"><div className="h-full bg-[#9C7C4E] rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} /></div>
                </div>
              ) : (
                <><Upload className="w-8 h-8 text-[#9E9789]" /><p className="text-[12px] text-[#7A7468]"><span className="text-[#9C7C4E] font-medium">Click to upload</span> or drag and drop</p><p className="text-[10px] text-[#9E9789]">PNG, JPG, WebP up to 5 MB</p></>
              )}
            </div>
            <div className="mt-2">
              <input type="url" placeholder="Or paste an image URL..." value={formData.imageUrl.startsWith('blob:') ? '' : formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] font-mono focus:border-[#9C7C4E]/50 focus:outline-none transition-colors" />
            </div>
          </div>
        </div>
      );
      case 3: return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[12px] font-semibold text-[#0A0A0A]">Variants</h3>
              <p className="text-[10px] text-[#9E9789]">Define size, color, and stock for each variant</p>
            </div>
            <button type="button" onClick={addVariant} className="flex items-center gap-1 text-[11px] text-[#9C7C4E] hover:text-[#876839] font-medium">
              <Plus className="w-3 h-3" /> Add Variant
            </button>
          </div>
          <div className="space-y-2">
            {variants.map((variant, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-[#FAF9F7] p-3 rounded-lg border border-[#E8E5DE]">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full border border-[#E8E5DE] shrink-0" style={{ backgroundColor: variant.colorHex }} />
                </div>
                <div className="w-20">
                  <label className="block text-[9px] text-[#9E9789] mb-0.5">Size</label>
                  <input type="text" value={variant.size} onChange={(e) => updateVariant(idx, 'size', e.target.value)}
                    className="w-full bg-white border border-[#E8E5DE] rounded px-2 py-1 text-[#0A0A0A] text-[11px] focus:border-[#9C7C4E]/50 focus:outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-[9px] text-[#9E9789] mb-0.5">Color</label>
                  <input type="text" value={variant.color} onChange={(e) => updateVariant(idx, 'color', e.target.value)}
                    className="w-full bg-white border border-[#E8E5DE] rounded px-2 py-1 text-[#0A0A0A] text-[11px] focus:border-[#9C7C4E]/50 focus:outline-none" />
                </div>
                <div className="w-16">
                  <label className="block text-[9px] text-[#9E9789] mb-0.5">Hex</label>
                  <input type="color" value={variant.colorHex} onChange={(e) => updateVariant(idx, 'colorHex', e.target.value)}
                    className="w-full h-7 bg-white border border-[#E8E5DE] rounded cursor-pointer" />
                </div>
                <div className="w-16">
                  <label className="block text-[9px] text-[#9E9789] mb-0.5">Stock</label>
                  <input type="number" value={variant.stock} onChange={(e) => updateVariant(idx, 'stock', e.target.value)}
                    className="w-full bg-white border border-[#E8E5DE] rounded px-2 py-1 text-[#0A0A0A] text-[11px] font-mono focus:border-[#9C7C4E]/50 focus:outline-none" />
                </div>
                {variants.length > 1 && (
                  <button type="button" onClick={() => removeVariant(idx)} className="p-1 text-[#9E9789] hover:text-red-500 transition-colors self-end"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            ))}
          </div>
          <div className="bg-[#FAF9F7] rounded-lg border border-[#E8E5DE] p-3">
            <p className="text-[10px] text-[#7A7468] font-medium mb-2">Quick Add Color Set</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button key={c.hex} type="button" onClick={() => {
                  const hasColor = variants.some(v => v.color === c.name);
                  if (!hasColor) {
                    const newVariants = ['XS','S','M','L','XL'].map(size => ({ size, color: c.name, colorHex: c.hex, stock: '20' }));
                    setVariants(prev => [...prev, ...newVariants]);
                  }
                }} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-medium transition-all ${variants.some(v => v.color === c.name) ? 'border-[#9C7C4E] bg-[#9C7C4E]/5 text-[#9C7C4E]' : 'border-[#E8E5DE] hover:border-[#9C7C4E]/30 text-[#7A7468]'}`}>
                  <span className="w-3 h-3 rounded-full border border-[#E8E5DE]" style={{ backgroundColor: c.hex }} />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
      case 4: return (
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-medium text-[#7A7468] mb-2">Collections</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {collections.map((col) => (
                <button key={col.id} type="button" onClick={() => toggleCollection(col.id)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-[11px] font-medium transition-all text-left ${
                    formData.collectionIds.includes(col.id) ? 'border-[#9C7C4E] bg-[#9C7C4E]/5 text-[#9C7C4E]' : 'border-[#E8E5DE] hover:border-[#9C7C4E]/30 text-[#7A7468]'
                  }`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${formData.collectionIds.includes(col.id) ? 'border-[#9C7C4E] bg-[#9C7C4E]' : 'border-[#E8E5DE]'}`}>
                    {formData.collectionIds.includes(col.id) && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  {col.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Tags</label>
            <input type="text" placeholder="linen, sustainable, casual (comma separated)" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full px-3 py-2 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[12px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors" />
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.featured} onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="w-4 h-4 rounded border-[#E8E5DE] text-[#9C7C4E] focus:ring-[#9C7C4E]" />
              <span className="text-[11px] text-[#7A7468]">Featured product</span>
            </label>
            <div>
              <label className="block text-[10px] font-medium text-[#7A7468] mb-1">Status</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="px-3 py-1.5 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[#0A0A0A] text-[11px] focus:border-[#9C7C4E]/50 focus:outline-none transition-colors">
                <option value="active">Published</option><option value="draft">Draft</option><option value="archived">Archived</option>
              </select>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-[12px]">
      {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 font-medium text-[11px]">{error}</div>}

      {/* Step Navigation */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-[#E8E5DE] p-1.5">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <button key={step.id} type="button" onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all flex-1 justify-center ${
                currentStep === i ? 'bg-[#0A0A0A] text-white' : 'text-[#7A7468] hover:bg-[#F3F1ED]'
              }`}>
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl border border-[#E8E5DE] p-5">
        <h2 className="text-[13px] font-semibold text-[#0A0A0A] mb-4">{STEPS[currentStep].label}</h2>
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-[#E8E5DE]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2 rounded-lg border border-[#E8E5DE] text-[#7A7468] hover:text-[#0A0A0A] hover:bg-[#F3F1ED] text-[11px] font-medium transition-colors">
            Cancel
          </button>
          {currentStep > 0 && (
            <button type="button" onClick={() => setCurrentStep(currentStep - 1)}
              className="flex items-center gap-1 px-4 py-2 rounded-lg border border-[#E8E5DE] text-[#0A0A0A] hover:bg-[#F3F1ED] text-[11px] font-medium transition-colors">
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentStep < STEPS.length - 1 ? (
            <button type="button" onClick={() => setCurrentStep(currentStep + 1)}
              className="flex items-center gap-1 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white px-4 py-2 rounded-lg text-[11px] font-medium transition-colors">
              Next <ArrowRight className="w-3 h-3" />
            </button>
          ) : (
            <button type="submit" disabled={loading}
              className="flex items-center gap-1.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-[11px] font-medium transition-colors">
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              {isEdit ? 'Update Product' : 'Publish Product'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
