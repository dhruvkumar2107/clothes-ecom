import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { apiOk, apiError } from '@/lib/api';
import { getUploadSignedUrl, deleteFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const UploadSchema = {
  fileName: { type: 'string', min: 1, max: 255 },
  contentType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] },
  folder: { type: 'string', enum: ['products', 'collections', 'categories', 'temp'], default: 'temp' },
};

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(['products.write']);
    const body = await request.json();
    const { fileName, contentType, folder = 'temp' } = body;

    if (!fileName || !contentType) {
      return apiError('VALIDATION_ERROR', 'fileName and contentType are required', 400);
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(contentType)) {
      return apiError('VALIDATION_ERROR', 'Invalid file type. Only JPEG, PNG, WebP, AVIF allowed', 400);
    }

    const ext = contentType.split('/')[1];
    const key = `${folder}/${crypto.randomUUID()}.${ext}`;

    const { uploadUrl, fileUrl } = await getUploadSignedUrl(key, contentType);

    return apiOk({ data: { uploadUrl, fileUrl, key } });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Upload signed URL error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to generate upload URL', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(['products.write']);
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return apiError('VALIDATION_ERROR', 'key parameter required', 400);
    }

    await deleteFile(key);
    return apiOk({ data: { deleted: true } });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Delete file error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to delete file', 500);
  }
}