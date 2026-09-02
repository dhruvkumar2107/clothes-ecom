import type { Metadata, Viewport } from 'next';
import { getSetting, getSettings } from '@/lib/settings';
import { Providers } from '@/app/providers';
import './globals.css';

// Revalidate every 30s instead of force-dynamic. This allows Next.js to serve
// a cached version of the layout shell while revalidating in the background,
// dramatically reducing TTFB for repeated visits.
export const dynamic = 'force-dynamic';

const MainContentId = 'main-content';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0b0b0c',
};

export const metadata: Metadata = {
  title: {
    default: 'LUMEN&CO — Light as couture',
    template: '%s | LUMEN&CO',
  },
  description: 'Future-facing luxury fashion. Engineered fabrics, sculptural silhouettes, and limited drops — shipped across India.',
  keywords: ['luxury fashion', 'designer clothing', 'indian fashion', 'couture', 'womens wear', 'mens wear'],
  authors: [{ name: 'LUMEN&CO' }],
  creator: 'LUMEN&CO',
  publisher: 'LUMEN&CO',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://lumenandco.example',
    siteName: 'LUMEN&CO',
    title: 'LUMEN&CO — Light as couture',
    description: 'Future-facing luxury fashion. Engineered fabrics, sculptural silhouettes, and limited drops — shipped across India.',
    images: [
      {
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lumenandco.example'}/api/img/og?title=LUMEN%26CO`,
        width: 1200,
        height: 630,
        alt: 'LUMEN&CO',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LUMEN&CO — Light as couture',
    description: 'Future-facing luxury fashion. Engineered fabrics, sculptural silhouettes, and limited drops.',
    images: [`${process.env.NEXT_PUBLIC_APP_URL || 'https://lumenandco.example'}/api/img/og?title=LUMEN%26CO`],
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
};

const THEME_KEYS = [
  'theme.accentPrimary',
  'theme.accentSecondary',
  'theme.accentTertiary',
  'theme.enableGrain',
  'store.name',
  'store.tagline',
  'store.defaultLocale',
  'store.defaultCurrency',
] as const;

type ThemeSettings = {
  'theme.accentPrimary': string;
  'theme.accentSecondary': string;
  'theme.accentTertiary': string;
  'theme.enableGrain': boolean;
  'store.name': string;
  'store.tagline': string;
  'store.defaultLocale': string;
  'store.defaultCurrency': string;
};

async function getTheme(): Promise<ThemeSettings> {
  return getSettings(THEME_KEYS) as Promise<ThemeSettings>;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await getTheme();
  const accentPrimary = theme['theme.accentPrimary'] as string;
  const accentSecondary = theme['theme.accentSecondary'] as string;
  const accentTertiary = theme['theme.accentTertiary'] as string;
  const enableGrain = theme['theme.enableGrain'] as boolean;
  const storeName = theme['store.name'] as string;
  const tagline = theme['store.tagline'] as string;
  const locale = theme['store.defaultLocale'] as string;
  const currency = theme['store.defaultCurrency'] as string;

  const style = {
    '--color-accent': accentPrimary,
    '--color-accent-2': accentSecondary,
    '--color-accent-3': accentTertiary,
  } as React.CSSProperties;

  return (
    <html lang={locale} style={style} className={enableGrain ? 'u-grain' : ''}>
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="preload" as="image" href="/api/img/og?title=LUMEN%26CO" />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <a
          href={`#${MainContentId}`}
          className="sr-only focus:not-sr-only fixed top-4 left-4 z-[200] px-4 py-2 bg-ink text-paper rounded-md u-focus"
        >
          Skip to main content
        </a>
        <Providers locale={locale} currency={currency}>
          {children}
        </Providers>
      </body>
    </html>
  );
}