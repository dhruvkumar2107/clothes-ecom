import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname),

  // Enable gzip/brotli compression for all responses
  compress: true,

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    // Automatic memoization of identical props/requests during render
    // Reduces redundant DB calls when the same data is needed in multiple places
    optimizePackageImports: ['lucide-react', 'date-fns', 'tailwind-merge'],
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Allow larger device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  },

  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // Cache optimized images aggressively — the Next.js image optimizer serves
      // immutable hashes, so the browser (and any CDN in front) can keep them
      // indefinitely.  Without this header every image request hits the Render
      // server which then fetches from the upstream CDN, doubling latency.
      {
        source: '/_next/image',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Cache API responses briefly with stale-while-revalidate for speed
      {
        source: '/api/cart',
        headers: [
          { key: 'Cache-Control', value: 'private, max-age=5, stale-while-revalidate=30' },
        ],
      },
      {
        source: '/api/search',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=60, stale-while-revalidate=300' },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/health',
        destination: '/api/health',
      },
    ];
  },
};

export default nextConfig;