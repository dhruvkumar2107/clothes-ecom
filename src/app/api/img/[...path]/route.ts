import { NextRequest, NextResponse } from 'next/server';
import {
  parseImgPath,
  paletteFor,
  seedFloat,
  seedInt,
  seedPick,
  shiftHex,
  type ImgKind,
  type ImgPalette,
} from '@/lib/img';

/**
 * The generated-imagery endpoint.
 *
 * Draws a deterministic SVG studio plate from a seed string. `src/lib/img.ts`
 * owns the addressing and the palette; this file owns the drawing, so the two
 * cannot disagree about what a URL means.
 *
 * Every response is immutable: the same URL always renders byte-identical
 * output, so it can be cached for a year at every layer. That is the whole point
 * — a product grid of thirty plates costs one round trip each on the first visit
 * and nothing after.
 *
 * Used for Open Graph cards (`/api/img/og?title=…`) and as the fallback plate
 * wherever a catalogue row has no photograph of its own.
 */

// A year, in seconds. Content is seed-addressed, so it can never go stale.
const IMMUTABLE = 'public, max-age=31536000, s-maxage=31536000, immutable';

function svgResponse(svg: string) {
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': IMMUTABLE,
      // These are drawn from a seed, never from user input reflected verbatim,
      // but the header costs nothing and stops a browser treating one as a
      // document if it is ever opened directly.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}

/** XML-escape anything that reaches a text node or an attribute. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Round to two decimals — keeps the markup small without visible artefacts. */
const n = (value: number) => Math.round(value * 100) / 100;

// ── Shared plate furniture ──────────────────────────────────────────────────

/**
 * Backdrop: a soft diagonal sweep plus a vignette, which is what makes these
 * read as a lit studio wall rather than a flat colour swatch.
 */
function ground(palette: ImgPalette, w: number, h: number, seed: string): string {
  const angle = seedInt(seed, 100, 260, 7);
  return `
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle} .5 .5)">
    <stop offset="0" stop-color="${palette.ground}"/>
    <stop offset="1" stop-color="${palette.groundAlt}"/>
  </linearGradient>
  <radialGradient id="v" cx="50%" cy="42%" r="72%">
    <stop offset="0" stop-color="#fff" stop-opacity="0.10"/>
    <stop offset="1" stop-color="#000" stop-opacity="0.22"/>
  </radialGradient>
  <linearGradient id="c" x1="0" y1="0" x2="0.35" y2="1">
    <stop offset="0" stop-color="${palette.sheen}"/>
    <stop offset="0.48" stop-color="${palette.cloth}"/>
    <stop offset="1" stop-color="${palette.shade}"/>
  </linearGradient>
  <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
    <feGaussianBlur stdDeviation="${n(Math.min(w, h) * 0.012)}"/>
  </filter>
</defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<rect width="${w}" height="${h}" fill="url(#v)"/>`;
}

/**
 * The label mark. Small, bottom-left, in the ground's ink — the same place a
 * lookbook would carry a caption.
 */
function mark(palette: ImgPalette, w: number, h: number, label?: string): string {
  if (!label) return '';
  const size = Math.max(11, Math.round(Math.min(w, h) * 0.035));
  return `<text x="${n(w * 0.06)}" y="${n(h - h * 0.05)}" fill="${palette.ink}" fill-opacity="0.62"
    font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif" font-size="${size}"
    letter-spacing="${n(size * 0.18)}" font-weight="500">${esc(label.toUpperCase().slice(0, 28))}</text>`;
}

// ── Garment compositions ────────────────────────────────────────────────────

/**
 * A garment on a figure, cut off at the shoulders and mid-thigh the way a
 * catalogue crop is. `variant` cycles the composition so one product's gallery
 * is not four copies of the same shape.
 */
function figure(palette: ImgPalette, w: number, h: number, seed: string, variant: number): string {
  const cx = w * (0.5 + (seedFloat(seed, 11) - 0.5) * 0.06);
  const shoulder = w * (0.17 + seedFloat(seed, 12) * 0.05);
  const top = h * 0.14;
  const hem = h * (0.74 + seedFloat(seed, 13) * 0.12);
  const waist = shoulder * (0.82 + seedFloat(seed, 14) * 0.22);
  const flare = variant % 2 === 0 ? 1.16 : 0.94;

  // Body: shoulders → waist → hem, drawn as one closed path so the drape reads
  // as a single piece of cloth rather than stacked rectangles.
  const body = [
    `M ${n(cx - shoulder)} ${n(top)}`,
    `C ${n(cx - shoulder * 1.05)} ${n(top + (hem - top) * 0.3)} ${n(cx - waist)} ${n(top + (hem - top) * 0.52)} ${n(cx - waist * flare)} ${n(hem)}`,
    `L ${n(cx + waist * flare)} ${n(hem)}`,
    `C ${n(cx + waist)} ${n(top + (hem - top) * 0.52)} ${n(cx + shoulder * 1.05)} ${n(top + (hem - top) * 0.3)} ${n(cx + shoulder)} ${n(top)}`,
    `Q ${n(cx)} ${n(top + h * 0.045)} ${n(cx - shoulder)} ${n(top)}`,
    'Z',
  ].join(' ');

  // Fold lines. Deterministic count and offsets, so the same seed always drapes
  // the same way.
  const folds = seedInt(seed, 3, 6, 15);
  let drape = '';
  for (let i = 0; i < folds; i += 1) {
    const t = (i + 1) / (folds + 1);
    const x = cx - waist * 0.86 + waist * 1.72 * t;
    const wobble = (seedFloat(seed, 40 + i) - 0.5) * w * 0.05;
    drape += `<path d="M ${n(x)} ${n(top + h * 0.1)} Q ${n(x + wobble)} ${n((top + hem) / 2)} ${n(x + wobble * 0.4)} ${n(hem - h * 0.02)}"
      stroke="${palette.shade}" stroke-opacity="0.3" stroke-width="${n(Math.max(1, w * 0.0025))}" fill="none"/>`;
  }

  // Neckline shape varies by composition — a crew, a v, or a mandarin band.
  const neckKind = variant % 3;
  const neckW = shoulder * 0.42;
  const neck =
    neckKind === 0
      ? `<path d="M ${n(cx - neckW)} ${n(top + h * 0.005)} Q ${n(cx)} ${n(top + h * 0.075)} ${n(cx + neckW)} ${n(top + h * 0.005)}"
           fill="${palette.groundAlt}"/>`
      : neckKind === 1
        ? `<path d="M ${n(cx - neckW)} ${n(top)} L ${n(cx)} ${n(top + h * 0.11)} L ${n(cx + neckW)} ${n(top)} Z"
           fill="${palette.groundAlt}"/>`
        : `<rect x="${n(cx - neckW)}" y="${n(top - h * 0.005)}" width="${n(neckW * 2)}" height="${n(h * 0.028)}"
           fill="${palette.trim}" fill-opacity="0.85" rx="${n(h * 0.006)}"/>`;

  // Sleeves, only on the compositions that show them.
  const sleeves =
    variant % 4 === 3
      ? ''
      : `<path d="M ${n(cx - shoulder)} ${n(top + h * 0.01)} Q ${n(cx - shoulder * 1.5)} ${n(top + h * 0.16)} ${n(cx - shoulder * 1.32)} ${n(top + h * 0.42)}
           L ${n(cx - shoulder * 0.98)} ${n(top + h * 0.4)} Z" fill="url(#c)" opacity="0.92"/>
         <path d="M ${n(cx + shoulder)} ${n(top + h * 0.01)} Q ${n(cx + shoulder * 1.5)} ${n(top + h * 0.16)} ${n(cx + shoulder * 1.32)} ${n(top + h * 0.42)}
           L ${n(cx + shoulder * 0.98)} ${n(top + h * 0.4)} Z" fill="url(#c)" opacity="0.92"/>`;

  return `
<ellipse cx="${n(cx)}" cy="${n(hem + h * 0.03)}" rx="${n(waist * 1.5)}" ry="${n(h * 0.022)}"
  fill="#000" fill-opacity="0.14" filter="url(#soft)"/>
${sleeves}
<path d="${body}" fill="url(#c)"/>
${drape}
${neck}
<path d="${body}" fill="none" stroke="${palette.shade}" stroke-opacity="0.4" stroke-width="${n(Math.max(1, w * 0.002))}"/>`;
}

/** Folded packshot — the garment squared off on a surface, seen from above. */
function flatlay(palette: ImgPalette, w: number, h: number, seed: string): string {
  const pad = Math.min(w, h) * (0.17 + seedFloat(seed, 21) * 0.05);
  const x = pad;
  const y = h * 0.2;
  const bw = w - pad * 2;
  const bh = h * 0.6;
  const rot = (seedFloat(seed, 22) - 0.5) * 5;

  let creases = '';
  for (let i = 1; i <= 3; i += 1) {
    const cy = y + (bh / 4) * i;
    creases += `<line x1="${n(x + bw * 0.06)}" y1="${n(cy)}" x2="${n(x + bw * 0.94)}" y2="${n(cy)}"
      stroke="${palette.shade}" stroke-opacity="0.26" stroke-width="${n(Math.max(1, w * 0.002))}"/>`;
  }

  return `
<g transform="rotate(${n(rot)} ${n(w / 2)} ${n(h / 2)})">
  <rect x="${n(x + bw * 0.02)}" y="${n(y + bh * 0.03)}" width="${n(bw)}" height="${n(bh)}"
    fill="#000" fill-opacity="0.12" filter="url(#soft)" rx="${n(bw * 0.02)}"/>
  <rect x="${n(x)}" y="${n(y)}" width="${n(bw)}" height="${n(bh)}" fill="url(#c)" rx="${n(bw * 0.02)}"/>
  ${creases}
  <rect x="${n(x + bw * 0.36)}" y="${n(y + bh * 0.08)}" width="${n(bw * 0.28)}" height="${n(bh * 0.06)}"
    fill="${palette.trim}" fill-opacity="0.7" rx="${n(bh * 0.02)}"/>
  <rect x="${n(x)}" y="${n(y)}" width="${n(bw)}" height="${n(bh)}" fill="none"
    stroke="${palette.shade}" stroke-opacity="0.35" stroke-width="${n(Math.max(1, w * 0.0018))}" rx="${n(bw * 0.02)}"/>
</g>`;
}

/**
 * Wide editorial band — overlapping colour fields and a horizon, sized for a
 * hero or a letterbox banner where a garment would be lost.
 */
function editorial(palette: ImgPalette, w: number, h: number, seed: string): string {
  const horizon = h * (0.56 + seedFloat(seed, 31) * 0.14);
  const columns = seedInt(seed, 3, 5, 32);
  let bands = '';
  for (let i = 0; i < columns; i += 1) {
    const bx = (w / columns) * i;
    const bw = w / columns;
    const lift = seedFloat(seed, 60 + i) * h * 0.16;
    const tone = i % 2 === 0 ? palette.cloth : palette.shade;
    bands += `<rect x="${n(bx)}" y="${n(horizon - lift)}" width="${n(bw + 1)}" height="${n(h - horizon + lift)}"
      fill="${tone}" fill-opacity="${n(0.16 + seedFloat(seed, 80 + i) * 0.2)}"/>`;
  }

  const arcR = Math.min(w, h) * (0.2 + seedFloat(seed, 33) * 0.12);
  const arcX = w * (0.22 + seedFloat(seed, 34) * 0.56);

  return `
${bands}
<circle cx="${n(arcX)}" cy="${n(horizon - arcR * 0.15)}" r="${n(arcR)}" fill="url(#c)" fill-opacity="0.9"/>
<circle cx="${n(arcX)}" cy="${n(horizon - arcR * 0.15)}" r="${n(arcR)}" fill="none"
  stroke="${palette.trim}" stroke-opacity="0.5" stroke-width="${n(Math.max(1, w * 0.0015))}"/>
<line x1="0" y1="${n(horizon)}" x2="${n(w)}" y2="${n(horizon)}"
  stroke="${palette.ink}" stroke-opacity="0.16" stroke-width="${n(Math.max(1, h * 0.003))}"/>`;
}

/** Circular crop with a monogram — review authors, customer records. */
function avatar(palette: ImgPalette, w: number, h: number, seed: string): string {
  const r = Math.min(w, h) / 2;
  const initial = (seed.replace(/[^a-z0-9]/gi, '').charAt(0) || 'l').toUpperCase();
  return `
<circle cx="${n(w / 2)}" cy="${n(h / 2)}" r="${n(r)}" fill="url(#c)"/>
<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
  fill="${shiftHex(palette.cloth, -0.55)}" fill-opacity="0.85"
  font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif"
  font-size="${n(r * 0.95)}" font-weight="500">${esc(initial)}</text>`;
}

/**
 * Open Graph card. The headline is the whole composition here, so the garment
 * furniture is reduced to a corner motif and the type is set large.
 */
function ogCard(palette: ImgPalette, w: number, h: number, seed: string, label: string): string {
  // Wrap by width rather than character count so a long word does not overflow.
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const maxChars = 22;
  for (const word of words) {
    if (!line) line = word;
    else if ((line + ' ' + word).length <= maxChars) line += ' ' + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 3);

  const size = Math.round(h * (shown.length > 2 ? 0.11 : 0.135));
  const startY = h * 0.44 - ((shown.length - 1) * size * 1.18) / 2;

  const text = shown
    .map(
      (l, i) =>
        `<text x="${n(w * 0.075)}" y="${n(startY + i * size * 1.18)}" fill="${palette.ink}"
          font-family="ui-serif,Georgia,Cambria,Times New Roman,serif" font-size="${size}"
          font-weight="400" letter-spacing="${n(size * -0.01)}">${esc(l)}</text>`,
    )
    .join('');

  return `
<circle cx="${n(w * 0.88)}" cy="${n(h * 0.2)}" r="${n(h * 0.26)}" fill="url(#c)" fill-opacity="0.55"/>
<rect x="${n(w * 0.075)}" y="${n(h * 0.2)}" width="${n(h * 0.09)}" height="${n(h * 0.006)}"
  fill="${palette.trim}"/>
<text x="${n(w * 0.075)}" y="${n(h * 0.17)}" fill="${palette.ink}" fill-opacity="0.6"
  font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif" font-size="${n(h * 0.032)}"
  letter-spacing="${n(h * 0.008)}" font-weight="600">LUMEN&amp;CO</text>
${text}
<text x="${n(w * 0.075)}" y="${n(h - h * 0.075)}" fill="${palette.ink}" fill-opacity="0.5"
  font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif" font-size="${n(h * 0.028)}"
  letter-spacing="${n(h * 0.004)}">${esc(seedPick(['Engineered fabrics', 'Small runs', 'Made to be worn'], seed, 5))}</text>`;
}

// ── Composition table ───────────────────────────────────────────────────────

function draw(
  kind: ImgKind,
  palette: ImgPalette,
  w: number,
  h: number,
  seed: string,
  label?: string,
): string {
  switch (kind) {
    case 'product':
      // The trailing index in the seed selects the composition, so a gallery
      // built from one product slug varies frame to frame.
      return figure(palette, w, h, seed, seedInt(seed, 0, 3, 9));
    case 'flat':
      return flatlay(palette, w, h, seed);
    case 'hero':
    case 'banner':
      return editorial(palette, w, h, seed);
    case 'lookbook':
      return `${editorial(palette, w, h, seed)}${figure(palette, w, h, seed, 1)}`;
    case 'avatar':
      return avatar(palette, w, h, seed);
    case 'og':
      return ogCard(palette, w, h, seed, label ?? 'LUMEN&CO');
  }
}

// ── Route ───────────────────────────────────────────────────────────────────

/** Fallback size for the query-shaped OG form, which carries no dimensions. */
const OG_SIZE = { width: 1200, height: 630 };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await params;
  const query = request.nextUrl.searchParams;
  const label = query.get('label') ?? query.get('title') ?? undefined;
  const tone = query.get('tone') ?? undefined;

  const parsed = parseImgPath(path);

  // `/api/img/og?title=…` — the shape the document head uses, where a caller
  // has no seed and no dimensions to offer.
  if (!parsed) {
    if (path.length === 1 && path[0] === 'og') {
      const seed = label ?? 'lumen';
      const palette = paletteFor(seed, tone);
      const { width, height } = OG_SIZE;
      return svgResponse(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label ?? 'LUMEN&CO')}">` +
          ground(palette, width, height, seed) +
          ogCard(palette, width, height, seed, label ?? 'LUMEN&CO') +
          '</svg>',
      );
    }

    // Anything else is a malformed URL, not a missing image — say so plainly
    // rather than serving a plate that looks deliberate.
    return NextResponse.json(
      { ok: false, error: { code: 'BAD_REQUEST', message: 'Malformed image path' } },
      { status: 400 },
    );
  }

  const { kind, seed, width, height } = parsed;
  const palette = paletteFor(seed, tone);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label ?? kind)}">` +
    ground(palette, width, height, seed) +
    draw(kind, palette, width, height, seed, label) +
    (kind === 'og' ? '' : mark(palette, width, height, label)) +
    '</svg>';

  return svgResponse(svg);
}
