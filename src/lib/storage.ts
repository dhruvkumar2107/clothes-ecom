import crypto from 'node:crypto';

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './public/uploads';
const CDN_URL = process.env.CDN_URL || '';

export async function getUploadSignedUrl(key: string, contentType: string): Promise<{ uploadUrl: string; fileUrl: string }> {
  if (STORAGE_PROVIDER === 's3') {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read',
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    const fileUrl = `${CDN_URL || `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`}/${key}`;

    return { uploadUrl, fileUrl };
  }

  if (STORAGE_PROVIDER === 'cloudinary') {
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder: key.split('/')[0] },
      process.env.CLOUDINARY_API_SECRET!
    );

    const uploadUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`;
    const fileUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${key}`;

    return { uploadUrl, fileUrl };
  }

  // Local storage fallback
  const fileUrl = `${CDN_URL || ''}/uploads/${key}`;
  const uploadUrl = `/api/admin/upload/local?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(contentType)}`;

  return { uploadUrl, fileUrl };
}

export async function deleteFile(key: string): Promise<void> {
  if (STORAGE_PROVIDER === 's3') {
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
    await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }));
    return;
  }

  if (STORAGE_PROVIDER === 'cloudinary') {
    const { v2: cloudinary } = await import('cloudinary');
    await cloudinary.uploader.destroy(key);
    return;
  }

  // Local storage
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const filePath = path.join(UPLOAD_DIR, key);
  await fs.unlink(filePath).catch(() => {});
}

export function getPublicUrl(key: string): string {
  if (STORAGE_PROVIDER === 's3') {
    return `${CDN_URL || `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`}/${key}`;
  }
  if (STORAGE_PROVIDER === 'cloudinary') {
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${key}`;
  }
  return `${CDN_URL || ''}/uploads/${key}`;
}

export function generateSecureFileName(originalName: string): string {
  const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `${randomBytes}.${ext}`;
}