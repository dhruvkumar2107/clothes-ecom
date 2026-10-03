import { Redis } from '@upstash/redis';

/**
 * Thin Redis cache wrapper using Upstash (serverless Redis).
 *
 * Falls back gracefully when UPSTASH_REDIS_REST_URL is not set — every
 * operation becomes a no-op so the app works without Redis in local dev.
 *
 * Upstash free tier: 10,000 commands/day, 1 GB storage.
 */

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Return a no-op stub so callers don't need null checks.
    return null;
  }

  redis = new Redis({ url, token });
  return redis;
}

// ── Generic helpers ──────────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get<unknown>(key);
    if (raw === null) return null;
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as T;
  } catch (err) {
    console.warn(`[cache] GET ${key} failed:`, err);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch (err) {
    console.warn(`[cache] SET ${key} failed:`, err);
  }
}

export async function cacheInvalidate(...keys: string[]): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    if (keys.length === 1) {
      await r.del(keys[0]);
    } else {
      await r.del(...keys);
    }
  } catch (err) {
    console.warn(`[cache] DEL ${keys.join(',')} failed:`, err);
  }
}

/** Invalidate all keys matching a prefix. Uses SCAN to avoid blocking. */
export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    let cursor = '0';
    do {
      const result = await r.scan(cursor, { match: `${prefix}*`, count: 100 });
      cursor = result[0];
      const keys = result[1];
      if (keys.length > 0) {
        await r.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    console.warn(`[cache] SCAN ${prefix}* failed:`, err);
  }
}

// ── Typed cache-aside helpers ────────────────────────────────────────────────

/**
 * Read-through cache. Returns cached value if present, otherwise calls `fn`,
 * stores the result, and returns it.
 */
export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;

  const value = await fn();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

// ── Key builders ─────────────────────────────────────────────────────────────

export const keys = {
  homepage: () => 'lumen:homepage',
  product: (slug: string) => `lumen:product:${slug}`,
  category: (slug: string) => `lumen:category:${slug}`,
  collection: (slug: string) => `lumen:collection:${slug}`,
  categories: () => 'lumen:categories',
  collections: () => 'lumen:collections',
} as const;
