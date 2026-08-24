import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      slug,
      subtitle,
      description,
      story,
      basePrice, // in rupees from form
      compareAtPrice,
      fabric,
      occasion,
      fit,
      gender,
      categoryId,
      imageUrl,
      variants, // array of { size, color, colorHex, stock }
    } = body;

    if (!name || !slug || !basePrice || !categoryId) {
      return NextResponse.json(
        { error: 'Name, slug, base price, and category are required.' },
        { status: 400 }
      );
    }

    // Convert price rupees to paise (multiply by 100)
    const basePricePaise = Math.round(parseFloat(basePrice) * 100);
    const compareAtPricePaise = compareAtPrice ? Math.round(parseFloat(compareAtPrice) * 100) : null;

    // Default image if none provided
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

    // Build variants array
    const variantList =
      Array.isArray(variants) && variants.length > 0
        ? variants.map((v: any) => ({
            sku: `${slug.toUpperCase()}-${(v.size || 'M').toUpperCase()}-${(v.color || 'BLACK').toUpperCase().slice(0, 3)}`,
            size: v.size || 'M',
            color: v.color || 'Default',
            colorHex: v.colorHex || '#111111',
            priceDelta: 0,
            stock: parseInt(v.stock, 10) || 10,
            weightGrams: 300,
          }))
        : [
            { sku: `${slug.toUpperCase()}-M-DEF`, size: 'M', color: 'Natural', colorHex: '#111111', priceDelta: 0, stock: 25, weightGrams: 300 },
            { sku: `${slug.toUpperCase()}-L-DEF`, size: 'L', color: 'Natural', colorHex: '#111111', priceDelta: 0, stock: 20, weightGrams: 300 },
          ];

    const product = await prisma.product.create({
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

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create product.' },
      { status: 500 }
    );
  }
}