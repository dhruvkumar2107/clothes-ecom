import { db } from '@/lib/db';
import { NextResponse, NextRequest } from 'next/server';

export interface RateLimitKey {
  type: 'ip' | 'user' | 'api_key';
  identifier: string;
  path: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  total: number;
}

export class RateLimitError extends Error {
  public readonly code = 'RATE_LIMITED';
  public readonly limit: number;
  public readonly remaining: number;
  public readonly resetTime: number;
  public readonly retryAfter: number;

  constructor(
    message: string,
    limit: number,
    remaining: number,
    resetTime: number
  ) {
    super(message);
    this.name = 'RateLimitError';
    this.limit = limit;
    this.remaining = remaining;
    this.resetTime = resetTime;
    this.retryAfter = Math.ceil(resetTime / 1000);
  }
}

export async function checkRateLimit(
  key: RateLimitKey,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - windowMs;
  const resetTime = now + windowMs;

  const bucketKey = `${key.type}:${key.identifier}:${key.path}`;

  const existing = await db.rateLimitBucket.findUnique({
    where: { key: bucketKey },
  });

  if (!existing) {
    await db.rateLimitBucket.create({
      data: {
        key: bucketKey,
        count: 1,
        windowStart: new Date(windowStart),
        windowEnd: new Date(resetTime),
      },
    });
    return { allowed: true, remaining: maxRequests - 1, resetTime, total: maxRequests };
  }

  if (existing.windowEnd.getTime() < now) {
    await db.rateLimitBucket.update({
      where: { key: bucketKey },
      data: { count: 1, windowStart: new Date(windowStart), windowEnd: new Date(resetTime) },
    });
    return { allowed: true, remaining: maxRequests - 1, resetTime, total: maxRequests };
  }

  if (existing.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetTime: existing.windowEnd.getTime(), total: maxRequests };
  }

  await db.rateLimitBucket.update({
    where: { key: bucketKey },
    data: { count: { increment: 1 } },
  });

  return { allowed: true, remaining: maxRequests - existing.count - 1, resetTime: existing.windowEnd.getTime(), total: maxRequests };
}

export async function rateLimit(
  key: RateLimitKey,
  maxRequests: number,
  windowMs: number
): Promise<void> {
  const result = await checkRateLimit(key, maxRequests, windowMs);
  if (!result.allowed) {
    throw new RateLimitError('Too many requests', result.total, result.remaining, result.resetTime);
  }
}

export interface AuthRateLimitOptions {
  limit: number;
  window: string;
  keyPrefix: string;
}

export interface AuthRateLimitResult {
  limited: boolean;
  response?: NextResponse;
}

export async function authRateLimit(
  request: NextRequest,
  options: AuthRateLimitOptions
): Promise<AuthRateLimitResult> {
  try {
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const key: RateLimitKey = {
      type: 'ip',
      identifier: `${options.keyPrefix}:${ip}`,
      path: request.nextUrl.pathname,
    };

    const windowMs = parseWindow(options.window);
    const result = await checkRateLimit(key, options.limit, windowMs);

    if (!result.allowed) {
      const response = NextResponse.json(
        { error: 'Too many requests', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((result.resetTime - Date.now()) / 1000)) } }
      );
      return { limited: true, response };
    }

    return { limited: false };
  } catch (error) {
    // If rate limiting fails (e.g., table missing, DB timeout), allow the request through
    console.error('Rate limit check failed, allowing request:', error);
    return { limited: false };
  }
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) return 60 * 60 * 1000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 60 * 60 * 1000;
  }
}

export async function resetRateLimit(key: RateLimitKey): Promise<void> {
  const bucketKey = `${key.type}:${key.identifier}:${key.path}`;
  await db.rateLimitBucket.delete({ where: { key: bucketKey } }).catch(() => {});
}