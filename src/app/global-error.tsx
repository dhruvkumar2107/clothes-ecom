'use client';

/**
 * Last-resort boundary. Catches throws from the root layout itself — which the
 * per-segment `error.tsx` convention cannot, because that renders *inside* the
 * layout. Without this file a failing root layout returns a bare 500 with the
 * message stripped in production, so the user saw only an opaque digest.
 *
 * This replaces the root layout entirely, so it owns <html>/<body> and has to
 * import the stylesheet itself.
 */

import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen grid place-items-center bg-paper text-ink antialiased">
        <main className="u-container text-center py-32">
          <p className="u-label text-ink/50 mb-4">Error</p>
          <h1 className="u-display text-4xl md:text-6xl font-light mb-6">
            Something broke
          </h1>
          <p className="text-ink/60 max-w-md mx-auto mb-10 leading-relaxed">
            We hit an unexpected fault while building this page. Trying again
            often works — the issue has been logged either way.
          </p>
          {error.digest ? (
            <p className="u-label text-ink/40 mb-10">Reference {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="px-6 py-3 text-lg bg-ink text-paper rounded-md u-focus hover:bg-ink-2"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
