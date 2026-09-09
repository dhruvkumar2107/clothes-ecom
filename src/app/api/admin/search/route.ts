import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(['products.read']);
    const q = request.nextUrl.searchParams.get('q')?.trim().slice(0, 80) || '';
    if (!q) return apiOk({ data: { results: [] } });

    const results: { type: string; label: string; href: string }[] = [];

    const [products, orders, users, collections] = await Promise.all([
      db.product.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
            { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
          ],
        },
        take: 5,
        select: { id: true, name: true, slug: true },
      }),
      db.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: { id: true, orderNumber: true, grandTotal: true },
      }),
      db.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: { id: true, name: true, email: true },
      }),
      db.collection.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 3,
        select: { id: true, name: true, slug: true },
      }),
    ]);

    products.forEach((p) => results.push({ type: 'Product', label: p.name, href: `/admin/products/${p.id}` }));
    orders.forEach((o) => results.push({ type: 'Order', label: `#${o.orderNumber}`, href: `/admin/orders/${o.id}` }));
    users.forEach((u) => results.push({ type: 'Customer', label: `${u.name || 'Unnamed'} (${u.email || ''})`, href: `/admin/users/${u.id}` }));
    collections.forEach((c) => results.push({ type: 'Collection', label: c.name, href: `/admin/collections/${c.id}/edit` }));

    return apiOk({ data: { results: results.slice(0, 15) } });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    return apiError('INTERNAL_ERROR', 'Search failed', 500);
  }
}
