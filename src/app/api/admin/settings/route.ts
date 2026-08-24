import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';

export const dynamic = 'force-dynamic';

const SettingUpdateSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
  valueType: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
  group: z.string().max(50).default('general'),
  label: z.string().max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(['settings.read']);
    const settings = await db.setting.findMany({ orderBy: { group: 'asc' } });
    return apiOk({ data: settings });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin settings list error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load settings', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(['settings.write']);
    const body = await request.json();
    const parsed = SettingUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const { key, value, valueType, group, label } = parsed.data;

    let typedValue: any = value;
    if (valueType === 'number') typedValue = Number(value);
    else if (valueType === 'boolean') typedValue = value === 'true';
    else if (valueType === 'json') typedValue = JSON.parse(value);

    const setting = await db.setting.upsert({
      where: { key },
      update: { value: String(typedValue), valueType, group, label: label || key },
      create: { key, value: String(typedValue), valueType, group, label: label || key },
    });

    return apiOk({ data: setting });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin settings update error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to update setting', 500);
  }
}