import Link from 'next/link';
import { db } from '@/lib/db';
import { Shield, User, Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 50;

interface PageProps {
  searchParams: Promise<{ page?: string; entity?: string; staff?: string }>;
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const entity = params.entity || '';
  const staffId = params.staff || '';

  const where: Record<string, unknown> = {};
  if (entity) where.entity = entity;
  if (staffId) where.staffId = staffId;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        actorType: true,
        actorLabel: true,
        action: true,
        entity: true,
        entityId: true,
        summary: true,
        ip: true,
        createdAt: true,
        staff: { select: { name: true, email: true } },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const href = (next: Partial<{ page: number; entity: string; staff: string }>) => {
    const merged = { page, entity, staff: staffId, ...next };
    const search = new URLSearchParams();
    if (merged.page > 1) search.set('page', String(merged.page));
    if (merged.entity) search.set('entity', merged.entity);
    if (merged.staff) search.set('staff', merged.staff);
    const query = search.toString();
    return query ? `/admin/audit?${query}` : '/admin/audit';
  };

  const entities = [...new Set(logs.map((l) => l.entity))];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-semibold text-[#0A0A0A] flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
          <Shield className="w-5 h-5 text-[#9C7C4E]" />
          Audit Log
        </h1>
        <p className="text-[13px] text-[#7A7468] mt-0.5">{total.toLocaleString()} entries</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5">
        <Link
          href={href({ entity: '', page: 1 })}
          className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-colors ${
            !entity
              ? 'bg-[#9C7C4E]/10 text-[#9C7C4E] border border-[#9C7C4E]/20'
              : 'text-[#7A7468] border border-[#E8E5DE] hover:bg-[#F3F1ED]'
          }`}
        >
          All
        </Link>
        {['Product', 'Order', 'Coupon', 'StaffUser', 'User', 'WithdrawalRequest', 'Banner'].map((e) => (
          <Link
            key={e}
            href={href({ entity: e, page: 1 })}
            className={`px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-colors ${
              entity === e
                ? 'bg-[#9C7C4E]/10 text-[#9C7C4E] border border-[#9C7C4E]/20'
                : 'text-[#7A7468] border border-[#E8E5DE] hover:bg-[#F3F1ED]'
            }`}
          >
            {e}
          </Link>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E8E5DE] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[#FAF9F7] text-[#7A7468] uppercase text-[10px] tracking-wider border-b border-[#E8E5DE]">
              <tr>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Actor</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="px-5 py-3 font-medium">Entity</th>
                <th className="px-5 py-3 font-medium">Summary</th>
                <th className="px-5 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F1ED]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-[#9E9789]">No audit entries found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF9F7] transition-colors">
                    <td className="px-5 py-2.5 font-mono text-[10px] text-[#9E9789] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {log.actorType === 'staff' ? (
                          <User className="w-3 h-3 text-blue-500" />
                        ) : (
                          <Activity className="w-3 h-3 text-[#9E9789]" />
                        )}
                        <span className="text-[#0A0A0A]">{log.actorLabel || log.actorType}</span>
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <span className="font-mono text-[#9C7C4E] text-[11px]">{log.action}</span>
                    </td>
                    <td className="px-5 py-2.5 text-[#7A7468]">
                      {log.entity}
                      {log.entityId && (
                        <span className="text-[#9E9789] ml-1 font-mono text-[9px]">
                          {log.entityId.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-[#7A7468] max-w-xs truncate">
                      {log.summary || '—'}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-[9px] text-[#9E9789]">
                      {log.ip || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-[#9E9789]">
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className="px-3 py-1.5 text-[11px] bg-white border border-[#E8E5DE] hover:bg-[#F3F1ED] text-[#0A0A0A] rounded-lg transition-colors">
                Previous
              </Link>
            )}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page + i - 2;
              if (p < 1 || p > totalPages) return null;
              return (
                <Link
                  key={p}
                  href={href({ page: p })}
                  className={`px-3 py-1.5 text-[11px] rounded-lg transition-colors ${
                    p === page
                      ? 'bg-[#9C7C4E] text-white font-semibold'
                      : 'bg-white border border-[#E8E5DE] hover:bg-[#F3F1ED] text-[#0A0A0A]'
                  }`}
                >
                  {p}
                </Link>
              );
            })}
            {page < totalPages && (
              <Link href={href({ page: page + 1 })} className="px-3 py-1.5 text-[11px] bg-white border border-[#E8E5DE] hover:bg-[#F3F1ED] text-[#0A0A0A] rounded-lg transition-colors">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
