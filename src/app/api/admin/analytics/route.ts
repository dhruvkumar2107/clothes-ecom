import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';
import { startOfDay, subDays, subMonths, format } from 'date-fns';

const AnalyticsSchema = z.object({
  range: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
  metric: z.enum(['revenue', 'orders', 'users', 'conversion', 'aov', 'all']).default('all'),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(['analytics.read']);
    const params = parseQuery(request, AnalyticsSchema);

    const now = new Date();
    let startDate: Date;
    switch (params.range) {
      case '7d': startDate = subDays(now, 7); break;
      case '30d': startDate = subDays(now, 30); break;
      case '90d': startDate = subDays(now, 90); break;
      case '1y': startDate = subMonths(now, 12); break;
      default: startDate = new Date(0);
    }

    const where = { placedAt: { gte: startDate } };

    const [
      revenueAgg,
      ordersAgg,
      usersAgg,
      topProducts,
      topCategories,
      revenueByDay,
      ordersByStatus,
      conversionFunnel,
    ] = await Promise.all([
      db.order.aggregate({ where: { ...where, paymentStatus: 'paid' }, _sum: { grandTotal: true }, _count: true }),
      db.order.aggregate({ where, _count: true }),
      db.user.aggregate({ where: { createdAt: { gte: startDate } }, _count: true }),
      db.orderItem.groupBy({
        by: ['productId'],
        where: { order: { ...where, paymentStatus: 'paid' } },
        _sum: { qty: true, lineTotal: true },
        orderBy: { _sum: { lineTotal: 'desc' } },
        take: 10,
      }),
      db.orderItem.groupBy({
        by: ['productId'],
        where: { order: { ...where, paymentStatus: 'paid' } },
        _sum: { qty: true, lineTotal: true },
        orderBy: { _sum: { qty: 'desc' } },
        take: 10,
      }),
      db.$queryRaw`SELECT DATE("placedAt") as day, SUM("grandTotal") as revenue FROM "Order" WHERE "placedAt" >= ${startDate} AND "paymentStatus" = 'paid' GROUP BY DATE("placedAt") ORDER BY day ASC`,
      db.order.groupBy({ by: ['status'], where, _count: true }),
      db.$queryRaw`SELECT 
        (SELECT COUNT(*) FROM "User" WHERE "createdAt" >= ${startDate}) as visitors,
        (SELECT COUNT(*) FROM "Order" WHERE "placedAt" >= ${startDate}) as orders,
        (SELECT COUNT(*) FROM "Order" WHERE "placedAt" >= ${startDate} AND "paymentStatus" = 'paid') as paid_orders`,
    ]);

    const productIds = [...new Set([...topProducts.map(p => p.productId), ...topCategories.map(p => p.productId)])];
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, slug: true, images: { take: 1, select: { url: true } } },
    });

    return apiOk({
      data: {
        summary: {
          revenue: Number(revenueAgg._sum.grandTotal || 0),
          orders: ordersAgg._count,
          newUsers: usersAgg._count,
          aov: revenueAgg._count > 0 ? Number(revenueAgg._sum.grandTotal || 0) / revenueAgg._count : 0,
          conversionRate: 0, // Would need visitor tracking
        },
        topProducts: topProducts.map(p => {
          const product = products.find(pr => pr.id === p.productId);
          return { productId: p.productId, name: product?.name, slug: product?.slug, image: product?.images[0]?.url, revenue: Number(p._sum.lineTotal || 0), units: p._sum.qty || 0 };
        }),
        topCategories: topCategories.map(p => {
          const product = products.find(pr => pr.id === p.productId);
          return { productId: p.productId, name: product?.name, slug: product?.slug, units: p._sum.qty || 0 };
        }),
        revenueByDay: (revenueByDay as any[]).map(r => ({ day: format(new Date(r.day), 'MMM d'), revenue: Number(r.revenue) })),
        ordersByStatus: ordersByStatus.map(s => ({ status: s.status, count: s._count })),
        conversionFunnel: (conversionFunnel as any[])[0] || { visitors: 0, orders: 0, paid_orders: 0 },
      },
    });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin analytics error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load analytics', 500);
  }
}