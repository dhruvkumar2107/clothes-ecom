import Link from 'next/link';
import { db } from '@/lib/db';
import { Search, Star, Check, X, Eye, MessageSquare } from 'lucide-react';
import { SmartImage } from '@/components/ui/SmartImage';

export const dynamic = 'force-dynamic';

const PER_PAGE = 25;

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

export default async function AdminReviewsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 80);
  const status = params.status || '';
  const page = Math.max(1, Number(params.page) || 1);

  const where: Record<string, any> = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { product: { name: { contains: q, mode: 'insensitive' } } },
      { user: { name: { contains: q, mode: 'insensitive' } } },
      { body: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, rating: true, title: true, body: true, status: true, fitFeedback: true,
        verifiedPurchase: true, helpfulCount: true, createdAt: true,
        product: { select: { name: true, slug: true, images: { take: 1, select: { url: true } } } },
        user: { select: { name: true, email: true } },
      },
    }),
    db.review.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const pendingCount = await db.review.count({ where: { status: 'pending' } });
  const approvedCount = await db.review.count({ where: { status: 'approved' } });
  const rejectedCount = await db.review.count({ where: { status: 'rejected' } });

  const href = (next: Partial<{ status: string; page: number }>) => {
    const merged = { status, page, ...next };
    const search = new URLSearchParams();
    if (merged.status) search.set('status', merged.status);
    if (merged.page && merged.page > 1) search.set('page', String(merged.page));
    const query = search.toString();
    return query ? `/admin/reviews?${query}` : '/admin/reviews';
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-[#D4A853]/10 text-[#9C7C4E] border border-[#D4A853]/20',
    approved: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    rejected: 'bg-red-50 text-red-600 border border-red-200',
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>Reviews</h1>
        <p className="text-[12px] text-[#7A7468] mt-0.5">Manage customer reviews and feedback</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', value: pendingCount, color: '#F59E0B' },
          { label: 'Approved', value: approvedCount, color: '#10B981' },
          { label: 'Rejected', value: rejectedCount, color: '#EF4444' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E8E5DE] p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] font-medium text-[#7A7468]">{s.label}</span>
            </div>
            <div className="text-lg font-bold text-[#0A0A0A]">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <div className="flex bg-white border border-[#E8E5DE] rounded-lg overflow-hidden">
          {[
            { value: '', label: 'All' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ].map((s) => (
            <Link key={s.value} href={href({ status: s.value, page: 1 })}
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${status === s.value ? 'bg-[#9C7C4E]/10 text-[#9C7C4E]' : 'text-[#7A7468] hover:bg-[#F3F1ED]'}`}>
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-3">
        {reviews.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8E5DE] p-12 text-center text-[#9E9789] text-[12px]">No reviews found.</div>
        ) : reviews.map((review) => (
          <div key={review.id} className="bg-white rounded-xl border border-[#E8E5DE] p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-12 rounded-md bg-[#F3F1ED] overflow-hidden shrink-0">
                {review.product.images[0] && <SmartImage src={review.product.images[0].url} alt="" fill sizes="40px" className="object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/products/${review.product.slug}`} className="text-[11px] font-medium text-[#0A0A0A] hover:text-[#9C7C4E] truncate">{review.product.name}</Link>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${statusColors[review.status] || ''}`}>{review.status}</span>
                  </div>
                  <span className="text-[9px] text-[#9E9789] shrink-0">{new Date(review.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-[#D4A853] text-[#D4A853]' : 'text-[#E8E5DE]'}`} />
                  ))}
                  <span className="text-[10px] text-[#7A7468] ml-1">{review.rating}/5</span>
                  {review.verifiedPurchase && <span className="text-[9px] text-[#3D6B4D] ml-2 font-medium">✓ Verified</span>}
                </div>
                {review.title && <p className="text-[11px] font-semibold text-[#0A0A0A] mt-1.5">{review.title}</p>}
                <p className="text-[11px] text-[#7A7468] mt-0.5 line-clamp-2">{review.body}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[9px] text-[#9E9789]">By {review.user.name || 'Anonymous'}</span>
                  {review.fitFeedback && <span className="text-[9px] text-[#7A7468] bg-[#F3F1ED] px-1.5 py-0.5 rounded">Fit: {review.fitFeedback}</span>}
                  {review.helpfulCount > 0 && <span className="text-[9px] text-[#7A7468]">{review.helpfulCount} found helpful</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <p className="text-[10px] text-[#9E9789]">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}</p>
          <div className="flex items-center gap-1">
            {page > 1 && <Link href={href({ page: page - 1 })} className="px-3 py-1.5 text-[10px] bg-white border border-[#E8E5DE] hover:bg-[#F3F1ED] rounded-lg transition-colors">Previous</Link>}
            {page < totalPages && <Link href={href({ page: page + 1 })} className="px-3 py-1.5 text-[10px] bg-white border border-[#E8E5DE] hover:bg-[#F3F1ED] rounded-lg transition-colors">Next</Link>}
          </div>
        </nav>
      )}
    </div>
  );
}
