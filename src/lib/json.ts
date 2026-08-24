/**
 * JSON column codecs.
 *
 * SQLite has no JSON column type in Prisma, so structured payloads live in
 * `*Json String` fields. Reading them with a bare `JSON.parse` is a landmine:
 * one malformed row (a bad CSV import, a hand-edit in Prisma Studio) throws
 * inside a server component and takes down the whole page.
 *
 * These helpers never throw. They return a fallback and, in development, log
 * loudly so the bad row gets fixed rather than silently swallowed.
 */

/** Parse a JSON column, falling back if it's null/empty/corrupt. */
export function readJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[json] malformed JSON column, using fallback:', raw.slice(0, 120));
    }
    return fallback;
  }
}

/** Parse into an array, tolerating a single object or a JSON-encoded array. */
export function readJsonArray<T>(raw: string | null | undefined): T[] {
  const value = readJson<T[] | T | null>(raw, []);
  if (Array.isArray(value)) return value;
  return value === null || value === undefined ? [] : [value];
}

/** Serialise for storage. `undefined` becomes null so Prisma clears the column. */
export function writeJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

/** Like writeJson but always produces a string — for non-nullable columns. */
export function writeJsonStrict(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/**
 * Parse a JSON column against a zod-like validator. Returns the fallback when
 * the shape doesn't match, so a schema change can't crash a render.
 */
export function readJsonSafe<T>(
  raw: string | null | undefined,
  validator: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  fallback: T,
): T {
  if (!raw) return fallback;
  try {
    const result = validator.safeParse(JSON.parse(raw));
    return result.success && result.data !== undefined ? result.data : fallback;
  } catch {
    return fallback;
  }
}

// ── CSV-in-a-column helpers ─────────────────────────────────────────────────
//
// A few columns store short scalar lists as comma-separated values instead of
// JSON (`tagsCsv`, `permissionsCsv`, `fraudFlagsCsv`). CSV wins there because
// those columns get filtered with SQL `contains`, which JSON escaping would
// break.

export function readCsv(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function writeCsv(values: readonly string[] | null | undefined): string | null {
  if (!values || values.length === 0) return null;
  const unique = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
  return unique.length ? unique.join(',') : null;
}

export function csvIncludes(raw: string | null | undefined, needle: string): boolean {
  return readCsv(raw).includes(needle);
}
