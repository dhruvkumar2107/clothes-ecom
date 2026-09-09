import Link from 'next/link';
import { db } from '@/lib/db';
import { Plus, Edit, Eye, EyeOff, Image, Layout, GripVertical, ArrowUpRight } from 'lucide-react';
import { SmartImage } from '@/components/ui/SmartImage';

export const dynamic = 'force-dynamic';

export default async function AdminContentPage() {
  const [banners, sections] = await Promise.all([
    db.banner.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, name: true, placement: true, headline: true, subhead: true,
        imageUrl: true, active: true, sortOrder: true, impressions: true, clicks: true,
      },
    }),
    db.homepageSection.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, kind: true, title: true, subtitle: true, active: true, sortOrder: true,
      },
    }),
  ]);

  const placementLabels: Record<string, string> = {
    home_hero: 'Homepage Hero',
    strip: 'Announcement Strip',
    category: 'Category Page',
    plp: 'Product Listing',
    checkout: 'Checkout',
  };

  const sectionKindLabels: Record<string, string> = {
    hero: 'Hero Section',
    collection_strip: 'Collection Strip',
    product_carousel: 'Product Carousel',
    editorial: 'Editorial',
    lookbook: 'Lookbook',
    marquee: 'Marquee',
    quiz_cta: 'Style Quiz CTA',
    usp_row: 'USP Row',
    testimonial: 'Testimonials',
    newsletter: 'Newsletter',
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>Content</h1>
        <p className="text-[12px] text-[#7A7468] mt-0.5">Manage banners, homepage sections, and editorial content</p>
      </div>

      {/* Banners Section */}
      <div className="bg-white rounded-xl border border-[#E8E5DE] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[13px] font-semibold text-[#0A0A0A]">Banners</h2>
            <p className="text-[10px] text-[#9E9789]">Hero banners, announcement strips, and promotional placements</p>
          </div>
          <span className="text-[10px] text-[#7A7468]">{banners.length} banners</span>
        </div>

        {banners.length === 0 ? (
          <div className="text-center py-12 text-[#9E9789] text-[12px]">No banners configured yet.</div>
        ) : (
          <div className="space-y-2">
            {banners.map((banner) => (
              <div key={banner.id} className="flex items-center gap-4 p-3 rounded-lg border border-[#E8E5DE] hover:bg-[#FAF9F7] transition-colors">
                <div className="w-16 h-10 rounded-md bg-[#F3F1ED] overflow-hidden shrink-0">
                  {banner.imageUrl && <SmartImage src={banner.imageUrl} alt="" width={64} height={40} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-[#0A0A0A]">{banner.name}</span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                      banner.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-[#F3F1ED] text-[#7A7468] border border-[#E8E5DE]'
                    }`}>{banner.active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <p className="text-[10px] text-[#7A7468] mt-0.5">{placementLabels[banner.placement] || banner.placement}</p>
                  <p className="text-[10px] text-[#9E9789] mt-0.5 line-clamp-1">{banner.headline}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-[#7A7468]">{banner.impressions.toLocaleString()} views</p>
                  <p className="text-[10px] text-[#9E9789]">{banner.clicks} clicks</p>
                </div>
                <Link href={`/admin/content`} className="p-1.5 text-[#7A7468] hover:text-[#9C7C4E] hover:bg-[#F3F1ED] rounded-md transition-colors" title="Edit">
                  <Edit className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Homepage Sections */}
      <div className="bg-white rounded-xl border border-[#E8E5DE] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[13px] font-semibold text-[#0A0A0A]">Homepage Sections</h2>
            <p className="text-[10px] text-[#9E9789]">Drag-and-drop homepage layout configuration</p>
          </div>
          <span className="text-[10px] text-[#7A7468]">{sections.length} sections</span>
        </div>

        {sections.length === 0 ? (
          <div className="text-center py-12 text-[#9E9789] text-[12px]">No homepage sections configured.</div>
        ) : (
          <div className="space-y-1.5">
            {sections.map((section, i) => (
              <div key={section.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#E8E5DE] hover:bg-[#FAF9F7] transition-colors">
                <div className="w-6 h-6 rounded bg-[#F3F1ED] flex items-center justify-center text-[10px] font-bold text-[#9E9789]">
                  {i + 1}
                </div>
                <GripVertical className="w-3 h-3 text-[#E8E5DE] cursor-grab" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-[#0A0A0A]">{section.title || sectionKindLabels[section.kind] || section.kind}</span>
                    <span className="text-[9px] text-[#9E9789] bg-[#F3F1ED] px-1.5 py-0.5 rounded">{section.kind}</span>
                  </div>
                  {section.subtitle && <p className="text-[10px] text-[#9E9789] mt-0.5">{section.subtitle}</p>}
                </div>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                  section.active ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-[#F3F1ED] text-[#7A7468] border border-[#E8E5DE]'
                }`}>{section.active ? 'Active' : 'Hidden'}</span>
                <Link href={`/admin/content`} className="p-1.5 text-[#7A7468] hover:text-[#9C7C4E] hover:bg-[#F3F1ED] rounded-md transition-colors" title="Edit">
                  <Edit className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Banners', href: '/admin/content', count: banners.length },
          { label: 'Homepage', href: '/admin/content', count: sections.length },
          { label: 'Collections', href: '/admin/collections', count: '—' },
          { label: 'Categories', href: '/admin/categories', count: '—' },
        ].map((link) => (
          <Link key={link.href + link.label} href={link.href}
            className="bg-white rounded-xl border border-[#E8E5DE] p-4 hover:shadow-sm transition-shadow group">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[#0A0A0A]">{link.label}</span>
              <ArrowUpRight className="w-3 h-3 text-[#9E9789] group-hover:text-[#9C7C4E] transition-colors" />
            </div>
            <p className="text-[10px] text-[#9E9789] mt-1">{link.count} items</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
