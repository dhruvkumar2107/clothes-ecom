import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CreateProductSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  story: z.string().optional(),
  basePrice: z.string().min(1),
  compareAtPrice: z.string().optional(),
  fabric: z.string().optional(),
  occasion: z.string().optional(),
  fit: z.string().optional(),
  gender: z.string().optional(),
  categoryId: z.string().cuid(),
  imageUrl: z.string().url().optional(),
  variants: z.array(z.object({
    size: z.string().optional(),
    color: z.string().optional(),
    colorHex: z.string().optional(),
    stock: z.string().optional(),
  })).optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin(['products.write']);
    const body = await req.json();
    const parsed = CreateProductSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid input', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const {
      name,
      slug,
      subtitle,
      description,
      story,
      basePrice,
      compareAtPrice,
      fabric,
      occasion,
      fit,
      gender,
      categoryId,
      imageUrl,
      variants,
    } = parsed.data;

    const basePricePaise = Math.round(parseFloat(basePrice) * 100);
    const compareAtPricePaise = compareAtPrice ? Math.round(parseFloat(compareAtPrice) * 100) : null;

    const imageList = imageUrl
      ? [{ url: imageUrl, alt: name, kind: 'gallery', sortOrder: 1 }]
      : [
          {
            url: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1200&q=80',
            alt: name,
            kind: 'gallery',
            sortOrder: 1,
          },
        ];

    const variantList =
      Array.isArray(variants) && variants.length > 0
        ? variants.map((v) => ({
            sku: `${slug.toUpperCase()}-${(v.size || 'M').toUpperCase()}-${(v.color || 'BLACK').toUpperCase().slice(0, 3)}`,
            size: v.size || 'M',
            color: v.color || 'Default',
            colorHex: v.colorHex || '#111111',
            priceDelta: 0,
            stock: parseInt(v.stock || '10', 10) || 10,
            weightGrams: 300,
          }))
        : [
            { sku: `${slug.toUpperCase()}-M-DEF`, size: 'M', color: 'Natural', colorHex: '#111111', priceDelta: 0, stock: 25, weightGrams: 300 },
            { sku: `${slug.toUpperCase()}-L-DEF`, size: 'L', color: 'Natural', colorHex: '#111111', priceDelta: 0, stock: 20, weightGrams: 300 },
          ];

    const product = await db.product.create({
      data: {
        name,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        subtitle,
        description: description || name,
        story,
        basePrice: basePricePaise,
        compareAtPrice: compareAtPricePaise,
        fabric: fabric || 'Premium Cotton Blend',
        occasion: occasion || 'casual',
        fit: fit || 'regular',
        gender: gender || 'unisex',
        status: 'active',
        featured: true,
        categoryId,
        images: { create: imageList },
        variants: { create: variantList },
      },
    });

    return apiOk({ data: product }, { status: 201 });
  } catch (error: any) {
    if (error?.code) {
      return apiError(error.code, error.message, error.status || 500);
    }
    console.error('Error creating product:', error);
    return apiError('INTERNAL_ERROR', 'Failed to create product.', 500);
  }
}
