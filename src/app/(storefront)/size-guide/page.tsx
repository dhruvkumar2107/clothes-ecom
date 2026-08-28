import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { readJsonArray } from '@/lib/json';
import { Ruler, Info } from 'lucide-react';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Size Guide | LUMEN&CO',
  description:
    'Body measurements for every LUMEN&CO size, how to measure yourself, and what to do when you are between sizes.',
  alternates: { canonical: '/size-guide' },
};

interface Chart {
  name: string;
  unit: string;
  columns: string[];
  rows: string[][];
  notes: string | null;
}

/**
 * Shipped so the page works on an empty database. A `SizeGuide` row replaces
 * these entirely — a half-database, half-built-in table would be worse than
 * either.
 */
const FALLBACK: Chart[] = [
  {
    name: "Women's Tops",
    unit: 'cm',
    columns: ['Size', 'Bust', 'Waist', 'Hip', 'Length'],
    rows: [
      ['XS', '82', '64', '90', '58'],
      ['S', '86', '68', '94', '59'],
      ['M', '90', '72', '98', '60'],
      ['L', '96', '78', '104', '61'],
      ['XL', '102', '84', '110', '62'],
    ],
    notes: 'Measure over undergarments. Length is taken from the shoulder seam.',
  },
  {
    name: "Men's Shirts",
    unit: 'cm',
    columns: ['Size', 'Chest', 'Waist', 'Neck', 'Sleeve', 'Length'],
    rows: [
      ['S', '92', '82', '38', '62', '74'],
      ['M', '98', '88', '39', '63', '75'],
      ['L', '104', '94', '41', '64', '76'],
      ['XL', '110', '100', '42', '65', '77'],
      ['XXL', '116', '106', '43', '66', '78'],
    ],
    notes: 'Chest is measured at the fullest part. Sleeve is measured from centre back.',
  },
];

const HOW_TO_MEASURE = [
  {
    label: 'Bust / chest',
    body: 'Around the fullest part, tape level under the arms and parallel to the floor.',
  },
  {
    label: 'Waist',
    body: 'At your natural waist — the narrowest point, usually just above the navel. Do not pull the tape tight.',
  },
  { label: 'Hip', body: 'Around the fullest part of the hips, roughly 20 cm below the waist.' },
  { label: 'Neck', body: 'Around the base of the neck, with one finger between the tape and skin.' },
  {
    label: 'Sleeve',
    body: 'From the centre back of your neck, over the shoulder, down to the wrist bone with the arm slightly bent.',
  },
];

export default async function SizeGuidePage() {
  // Fail soft: a database that is unreachable should still render the guide.
  const rows = await db.sizeGuide
    .findMany({
      orderBy: { name: 'asc' },
      select: {
        name: true,
        unit: true,
        columnsJson: true,
        rowsJson: true,
        notes: true,
        category: { select: { name: true } },
      },
    })
    .catch(() => []);

  const charts: Chart[] = rows.length
    ? rows.map((row) => ({
        name: row.category?.name ? `${row.name} — ${row.category.name}` : row.name,
        unit: row.unit,
        columns: readJsonArray<string>(row.columnsJson),
        rows: readJsonArray<string[]>(row.rowsJson),
        notes: row.notes,
      }))
    : FALLBACK;

  // A chart with no columns is a broken row, not an empty one — drop it rather
  // than render a headerless table.
  const usable = charts.filter((chart) => chart.columns.length > 0 && chart.rows.length > 0);

  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-4xl">
        <header className="mb-14 max-w-2xl">
          <p className="u-label text-muted-2 mb-3">Fit</p>
          <h1 className="u-display text-3xl lg:text-5xl font-light tracking-tight text-ink mb-5">
            Size guide
          </h1>
          <p className="text-ink-3 text-lg leading-relaxed">
            These are body measurements, not garment measurements — measure yourself and match the
            row. Every product page also carries the chart for that specific cut.
          </p>
        </header>

        <div className="border border-line rounded-lg bg-paper-2/40 p-6 mb-14 flex gap-4">
          <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-ink-2 leading-relaxed space-y-2">
            <p>
              <span className="font-semibold text-ink">Between two sizes?</span> On a structured
              piece — a shirt, a jacket, tailored trousers — take the larger. On knits and jersey,
              stay with your usual size.
            </p>
            <p>
              Anything labelled <span className="font-semibold text-ink">oversized</span> or{' '}
              <span className="font-semibold text-ink">relaxed</span> is already cut generously.
              Do not size up on those.
            </p>
          </div>
        </div>

        <div className="space-y-14">
          {usable.map((chart) => (
            <section key={chart.name}>
              <div className="flex items-baseline justify-between gap-4 mb-4">
                <h2 className="u-title text-xl font-semibold text-ink">{chart.name}</h2>
                <span className="u-label text-muted-2 shrink-0">
                  All measurements in {chart.unit === 'in' ? 'inches' : 'centimetres'}
                </span>
              </div>

              <div className="overflow-x-auto border border-line rounded-lg">
                <table className="w-full text-sm text-left tabular-nums">
                  <caption className="sr-only">
                    {chart.name} body measurements in{' '}
                    {chart.unit === 'in' ? 'inches' : 'centimetres'}
                  </caption>
                  <thead className="bg-paper-2 border-b border-line">
                    <tr>
                      {chart.columns.map((column, index) => (
                        <th
                          key={column}
                          scope="col"
                          className={`u-label px-4 py-3 text-ink-3 font-medium whitespace-nowrap ${
                            index === 0 ? 'sticky left-0 bg-paper-2' : ''
                          }`}
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {chart.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-paper-2/60 transition-colors">
                        {chart.columns.map((_, j) => (
                          <td
                            key={j}
                            className={
                              j === 0
                                ? 'px-4 py-3 font-semibold text-ink whitespace-nowrap sticky left-0 bg-paper'
                                : 'px-4 py-3 text-ink-2'
                            }
                          >
                            {row[j] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {chart.notes ? (
                <p className="text-xs text-muted-2 mt-3 leading-relaxed">{chart.notes}</p>
              ) : null}
            </section>
          ))}
        </div>

        <section className="mt-16 pt-12 border-t border-line">
          <h2 className="u-title text-xl font-semibold text-ink mb-2 flex items-center gap-3">
            <Ruler className="w-5 h-5 text-accent" aria-hidden="true" />
            How to measure
          </h2>
          <p className="text-sm text-ink-3 mb-6 max-w-xl leading-relaxed">
            Use a soft tape, stand relaxed, and keep the tape snug rather than tight. If you can, ask
            someone else to take the reading — self-measuring runs small.
          </p>
          <dl className="space-y-4">
            {HOW_TO_MEASURE.map(({ label, body }) => (
              <div key={label} className="sm:grid sm:grid-cols-[9rem_1fr] sm:gap-6">
                <dt className="u-label text-ink font-medium">{label}</dt>
                <dd className="text-sm text-ink-2 leading-relaxed mt-1 sm:mt-0">{body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="mt-14 pt-8 border-t border-line text-sm">
          <p className="text-ink-2 leading-relaxed">
            Still unsure? Tell us your measurements and what you are looking at, and we will pick the
            size for you —{' '}
            <Link href="/contact" className="text-ink hover:text-accent underline underline-offset-4 u-focus">
              get in touch
            </Link>
            . Exchanges are free once per order, so a wrong guess costs you nothing but time.
          </p>
        </footer>
      </div>
    </div>
  );
}
