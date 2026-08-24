/**
 * URL builder for the generated-imagery endpoint.
 *
 * The catalogue in this build ships with zero external image assets: every
 * product shot, hero, lookbook plate and avatar is an SVG synthesised on demand
 * by `/api/img` from a seed string. This module owns the *addressing* — the
 * route owns the drawing — so the seed data, the storefront and the renderer can
 * never disagree about what a given URL means.
 *
 * Paths are deliberately path-shaped rather than query-shaped
 * (`/api/img/product/silk-slip-dress/1200x1600.svg`) because `next.config.ts`
 * attaches an immutable, one-year cache header to `/api/img/(.*)`. A query-only
 * scheme would still match, but a path keeps the URL legible in the DOM and in
 * database rows, which matters when someone is debugging a broken row in
 * Prisma Studio.
 *
 * `hashSeed` and `paletteFor` live here too, exported, so the route imports the
 * same functions the rest of the app uses to predict a colour — a second copy
 * would drift the moment either side is tuned.
 */

const BASE = '/api/img';

export type ImgKind =
  | 'product'
  | 'flat'
  | 'hero'
  | 'lookbook'
  | 'banner'
  | 'avatar'
  | 'og';

// ── Seeding ─────────────────────────────────────────────────────────────────

/**
 * FNV-1a, 32-bit. Chosen over anything cryptographic because it has to run
 * identically in the seed script, on the server and (potentially) in the
 * browser, and because the only requirement is a well-spread integer.
 */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic 0..1 from a seed plus a channel, so one seed yields many values. */
export function seedFloat(seed: string, channel = 0): number {
  return (hashSeed(`${seed}::${channel}`) % 100_000) / 100_000;
}

/** Deterministic integer in [min, max]. */
export function seedInt(seed: string, min: number, max: number, channel = 0): number {
  if (max <= min) return min;
  return min + (hashSeed(`${seed}::${channel}`) % (max - min + 1));
}

/** Deterministic pick from a list — the imagery equivalent of `seededPick`. */
export function seedPick<T>(items: readonly T[], seed: string, channel = 0): T {
  if (items.length === 0) throw new Error('seedPick: empty list');
  return items[hashSeed(`${seed}::${channel}`) % items.length];
}

// ── Palettes ────────────────────────────────────────────────────────────────

export interface ImgPalette {
  /** Backdrop the garment is photographed against. */
  ground: string;
  /** Secondary backdrop tone, used for the sweep/vignette. */
  groundAlt: string;
  /** The garment itself. */
  cloth: string;
  /** Fold and shadow tone — darker than `cloth`. */
  shade: string;
  /** Highlight along the drape — lighter than `cloth`. */
  sheen: string;
  /** Accent used for trims, stitching and the label mark. */
  trim: string;
  /** Ink for any lettering drawn into the plate. */
  ink: string;
}

/**
 * Studio grounds. Kept warm and desaturated — a saturated backdrop reads as a
 * stock placeholder, which is exactly the impression this endpoint exists to
 * avoid.
 */
const GROUNDS: readonly { ground: string; groundAlt: string; ink: string }[] = [
  { ground: '#f4f2ec', groundAlt: '#e8e4da', ink: '#1a1b1e' },
  { ground: '#efeae1', groundAlt: '#e0d9cc', ink: '#1a1b1e' },
  { ground: '#f7f5f1', groundAlt: '#ebe7e0', ink: '#0b0b0c' },
  { ground: '#e9e6e0', groundAlt: '#dad5cb', ink: '#0b0b0c' },
  { ground: '#1a1b1e', groundAlt: '#0b0b0c', ink: '#f4f2ec' },
  { ground: '#2b2926', groundAlt: '#1c1a18', ink: '#f0ece4' },
];

/**
 * The colour vocabulary the catalogue speaks. `ProductVariant.color` stores one
 * of these names and `colorHex` stores the matching value, so the swatch dot in
 * the UI, the variant record and the generated plate all agree.
 */
const CLOTH_COLORS: Record<string, string> = {
  ivory: '#f2ece1',
  bone: '#e7dfd2',
  chalk: '#f6f4ef',
  oat: '#ddd1bd',
  sand: '#cfbfa4',
  camel: '#b3906a',
  tobacco: '#8a6647',
  espresso: '#4a382c',
  cocoa: '#6b5040',
  charcoal: '#3a3b3d',
  onyx: '#141416',
  graphite: '#55585c',
  slate: '#6c7780',
  sage: '#8f9c8a',
  olive: '#6f7350',
  moss: '#4f5a41',
  fern: '#5d7355',
  clay: '#a9705f',
  terracotta: '#b26a4d',
  rust: '#94502f',
  brick: '#7d3a2c',
  wine: '#5c2430',
  plum: '#4a2b40',
  aubergine: '#3a2432',
  indigo: '#33405e',
  navy: '#232f4a',
  cobalt: '#31507e',
  powder: '#c3cedb',
  mist: '#d6dcdd',
  blush: '#e2c3bc',
  rose: '#c88f8a',
  petal: '#edd6d3',
  lilac: '#b3a6c4',
  emerald: '#26584a',
  teal: '#2c5a5c',
  jade: '#4a7d6d',
  mustard: '#b8893a',
  saffron: '#c68f34',
  gold: '#b08d57',
  champagne: '#d5c3a1',
  silver: '#b9bcbd',
  pearl: '#e4e2dc',
  scarlet: '#9c2b28',
  ink: '#1c1f26',
  stone: '#a49c90',
  taupe: '#9a8d7e',
};

/**
 * Resolve a colour name to hex. Unknown names hash into the vocabulary rather
 * than falling back to one default, so a colour the seed invents still renders
 * as a plausible, stable garment tone instead of grey.
 */
export function swatchHex(color: string): string {
  const key = color.trim().toLowerCase();
  const direct = CLOTH_COLORS[key];
  if (direct) return direct;

  // A hex value passed straight through is honoured as-is.
  if (/^#[0-9a-f]{6}$/i.test(key)) return key;

  const names = Object.keys(CLOTH_COLORS);
  return CLOTH_COLORS[seedPick(names, key)];
}

/** The catalogue's colour names, for the seed script and admin colour pickers. */
export const CLOTH_COLOR_NAMES: readonly string[] = Object.keys(CLOTH_COLORS);

/** Shift a hex colour's lightness by `amount` (−1..1). Used for fold and sheen. */
export function shiftHex(hex: string, amount: number): string {
  const value = hex.replace('#', '');
  const num = Number.parseInt(
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value,
    16,
  );
  const channels = [(num >> 16) & 255, (num >> 8) & 255, num & 255].map((c) => {
    const next = amount >= 0 ? c + (255 - c) * amount : c * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(next)));
  });
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Everything the renderer needs to draw one plate, derived entirely from the
 * seed. `tone` lets a caller pin the garment colour (the PDP passes the selected
 * variant's colour so switching swatches actually changes the picture).
 */
export function paletteFor(seed: string, tone?: string): ImgPalette {
  const ground = seedPick(GROUNDS, seed, 1);
  const cloth = tone ? swatchHex(tone) : swatchHex(seedPick(CLOTH_COLOR_NAMES, seed, 2));

  return {
    ground: ground.ground,
    groundAlt: ground.groundAlt,
    ink: ground.ink,
    cloth,
    shade: shiftHex(cloth, -0.28),
    sheen: shiftHex(cloth, 0.22),
    trim: shiftHex(cloth, -0.5),
  };
}

// ── URL building ────────────────────────────────────────────────────────────

/**
 * Normalise a seed into a path segment. Seeds are usually slugs already, but
 * order numbers, emails and product names all end up here too, and an unescaped
 * `/` or `#` would silently reshape the route.
 */
function seedSegment(seed: string): string {
  const cleaned = seed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || 'lumen';
}

export interface ImgOptions {
  /** Lettering drawn into the plate — a collection name, an initial, a season. */
  label?: string;
  /** Pin the garment colour instead of deriving it from the seed. */
  tone?: string;
}

/** Build a generated-image URL. All other helpers are thin wrappers over this. */
export function img(
  kind: ImgKind,
  seed: string,
  w: number,
  h: number,
  opts: ImgOptions = {},
): string {
  const query = new URLSearchParams();
  if (opts.label) query.set('label', opts.label);
  if (opts.tone) query.set('tone', opts.tone);

  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return `${BASE}/${kind}/${seedSegment(seed)}/${Math.round(w)}x${Math.round(h)}.svg${suffix}`;
}

/**
 * Product gallery frame. `index` selects the composition (on-figure, detail,
 * back, styled) so one product yields a varied gallery from a single seed.
 */
export function productImg(seed: string, index = 0, opts: ImgOptions = {}): string {
  return img('product', `${seed}-${index}`, 1200, 1600, opts);
}

/** Flat-lay / packshot — used for the swatch strip and cart thumbnails. */
export function flatImg(seed: string, opts: ImgOptions = {}): string {
  return img('flat', seed, 1200, 1600, opts);
}

/** Wide editorial hero. */
export function heroImg(seed: string, opts: ImgOptions = {}): string {
  return img('hero', seed, 2400, 1350, opts);
}

/** Tall lookbook plate. */
export function lookbookImg(seed: string, opts: ImgOptions = {}): string {
  return img('lookbook', seed, 1600, 2000, opts);
}

/** Letterbox banner for CMS `Banner` rows. */
export function bannerImg(seed: string, opts: ImgOptions = {}): string {
  return img('banner', seed, 2400, 800, opts);
}

/** Square avatar for review authors and customer records. */
export function avatarImg(seed: string, opts: ImgOptions = {}): string {
  return img('avatar', seed, 256, 256, opts);
}

/** Open Graph card. The label is rendered large, so keep it short. */
export function ogImg(seed: string, label?: string): string {
  return img('og', seed, 1200, 630, label ? { label } : {});
}

/**
 * Parse a path built by `img()` back into its parts.
 *
 * The route handler uses this rather than reimplementing the grammar, which
 * keeps the two ends of the contract in one file: a change to the path shape
 * here cannot compile against a stale parser.
 */
export interface ParsedImgPath {
  kind: ImgKind;
  seed: string;
  width: number;
  height: number;
}

const KINDS: readonly ImgKind[] = [
  'product',
  'flat',
  'hero',
  'lookbook',
  'banner',
  'avatar',
  'og',
];

/** Largest plate we will render. Caps a hostile `?w=99999` into something sane. */
export const MAX_IMG_DIMENSION = 3200;

export function parseImgPath(segments: readonly string[]): ParsedImgPath | null {
  if (segments.length !== 3) return null;
  const [kindRaw, seedRaw, sizeRaw] = segments;

  const kind = KINDS.find((k) => k === kindRaw);
  if (!kind) return null;

  const match = /^(\d{1,4})x(\d{1,4})\.svg$/.exec(sizeRaw);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 16 || height < 16) return null;
  if (width > MAX_IMG_DIMENSION || height > MAX_IMG_DIMENSION) return null;

  return { kind, seed: seedRaw, width, height };
}
