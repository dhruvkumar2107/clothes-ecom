import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const staff = await requireAdmin(['products.read', 'orders.read', 'customers.read']);
    const q = request.nextUrl.searchParams.get('q')?.trim().slice(0, 80) || '';
    if (!q) return apiOk({ results: [] });

    const results: { type: string; label: string; href: string }[] = [];

    const [products, orders, users, collections] = await Promise.all([
      staff.permissions.includes('products.read') ? db.product.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
            { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
          ],
        },
        take: 5,
        select: { id: true, name: true, slug: true },
      }) : Promise.resolve([]),
      staff.permissions.includes('orders.read') ? db.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: { id: true, orderNumber: true, grandTotal: true },
      }) : Promise.resolve([]),
      staff.permissions.includes('customers.read') ? db.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: { id: true, name: true, email: true },
      }) : Promise.resolve([]),
      staff.permissions.includes('products.read') ? db.collection.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 3,
        select: { id: true, name: true, slug: true },
      }) : Promise.resolve([]),
    ]);

    products.forEach((p) => results.push({ type: 'Product', label: p.name, href: `/admin/products/${p.id}/edit` }));
    orders.forEach((o) => results.push({ type: 'Order', label: `#${o.orderNumber}`, href: `/admin/orders/${o.id}` }));
    users.forEach((u) => results.push({ type: 'Customer', label: `${u.name || 'Unnamed'} (${u.email || ''})`, href: `/admin/users?q=${encodeURIComponent(u.email || u.name || '')}` }));
    collections.forEach((c) => results.push({ type: 'Collection', label: c.name, href: `/admin/collections/${c.id}/edit` }));

    return apiOk({ results: results.slice(0, 15) });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    return apiError('INTERNAL_ERROR', 'Search failed', 500);
  }
}
