import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getStaticPage, type ContentSection, type StaticPage } from '@/lib/content/pages';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Standing information and policy pages.
 *
 * Content comes from a `Page` row when the admin has written one, and from the
 * built-in defaults otherwise — so these URLs work on a fresh database and stay
 * editable on a live one. A slug that is neither is a genuine 404.
 */
async function resolve(slug: string): Promise<StaticPage | null> {
  // A row the admin authored wins outright — merging it with the default would
  // make edits look like they had not taken.
  const row = await db.page
    .findFirst({
      where: { slug, status: 'published' },
      select: { slug: true, title: true, body: true, seoTitle: true, seoDescription: true, updatedAt: true },
    })
    .catch(() => null);

  if (row) {
    return {
      slug: row.slug,
      title: row.title,
      seoDescription: row.seoDescription ?? row.title,
      updated: row.updatedAt.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      sections: parseBody(row.body),
    };
  }

  return getStaticPage(slug);
}

/**
 * Turn an admin-authored body into sections.
 *
 * The editor is a plain textarea, so this understands only three things: a line
 * starting with `##` is a heading, a line starting with `-` is a bullet, and
 * anything else is a paragraph. Everything renders as a text node, so there is
 * no markup to escape.
 */
function parseBody(body: string): ContentSection[] {
  const sections: ContentSection[] = [];
  let current: ContentSection = {};

  const push = () => {
    if (current.heading || current.paragraphs?.length || current.bullets?.length) {
      sections.push(current);
    }
    current = {};
  };

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('##')) {
      push();
      current.heading = line.replace(/^#+\s*/, '');
    } else if (/^[-*]\s+/.test(line)) {
      (current.bullets ??= []).push(line.replace(/^[-*]\s+/, ''));
    } else {
      (current.paragraphs ??= []).push(line);
    }
  }
  push();

  return sections;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await resolve(slug);
  if (!page) return { title: 'Not found | LUMEN&CO' };

  return {
    title: `${page.title} | LUMEN&CO`,
    description: page.seoDescription,
    alternates: { canonical: `/${page.slug}` },
  };
}

export default async function ContentPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await resolve(slug);
  if (!page) notFound();

  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-3xl">
        <header className="mb-12 text-center">
          <h1 className="u-display text-3xl lg:text-4xl font-light tracking-tight text-ink mb-4">
            {page.title}
          </h1>
          {page.intro ? (
            <p className="text-ink-3 leading-relaxed max-w-xl mx-auto">{page.intro}</p>
          ) : null}
          {page.updated ? (
            <p className="u-label text-muted-2 mt-4">Last updated: {page.updated}</p>
          ) : null}
        </header>

        <article className="space-y-10">
          {page.sections.map((section, index) => (
            <section key={section.heading ?? index}>
              {section.heading ? (
                <h2 className="u-title text-xl font-semibold text-ink mb-4">{section.heading}</h2>
              ) : null}

              {section.paragraphs?.map((paragraph, i) => (
                <p key={i} className="text-ink-2 leading-relaxed mb-4 last:mb-0">
                  {paragraph}
                </p>
              ))}

              {section.bullets?.length ? (
                <ul className="mt-4 space-y-2">
                  {section.bullets.map((bullet, i) => (
                    <li key={i} className="flex gap-3 text-ink-2 leading-relaxed">
                      <span className="text-accent mt-2 shrink-0" aria-hidden="true">
                        <svg width="5" height="5" viewBox="0 0 5 5" fill="currentColor">
                          <circle cx="2.5" cy="2.5" r="2.5" />
                        </svg>
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {section.table ? (
                <div className="mt-5 overflow-x-auto border border-line rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-paper-2 border-b border-line">
                      <tr>
                        {section.table.columns.map((column) => (
                          <th
                            key={column}
                            scope="col"
                            className="u-label px-4 py-3 text-ink-3 font-medium"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {section.table.rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j} className="px-4 py-3 text-ink-2">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
          ))}
        </article>

        <footer className="mt-16 pt-8 border-t border-line flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="text-muted-2">Related:</span>
          <Link href="/contact" className="text-ink-2 hover:text-ink underline underline-offset-4 u-focus">
            Contact us
          </Link>
          <Link href="/faq" className="text-ink-2 hover:text-ink underline underline-offset-4 u-focus">
            FAQs
          </Link>
          <Link href="/shipping" className="text-ink-2 hover:text-ink underline underline-offset-4 u-focus">
            Shipping
          </Link>
          <Link href="/returns" className="text-ink-2 hover:text-ink underline underline-offset-4 u-focus">
            Returns
          </Link>
        </footer>
      </div>
    </div>
  );
}
