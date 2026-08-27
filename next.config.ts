import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Emits .next/standalone — a self-contained server bundle the Docker runner copies.
  output: 'standalone',

  // Pin the tracing root to this project. Without it Next walks up looking for a
  // lockfile and can pick an ancestor directory, which nests server.js under a
  // deep subpath inside .next/standalone and breaks `node server.js`.
  outputFileTracingRoot: path.resolve(__dirname),

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    formats: ['image/avif', 'image/webp'],
    // Product and banner art is content-addressed by the CDN that serves it, so
    // an optimized variant can be reused for a long time. The default 60s makes
    // the server re-encode the same photo all day.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },

  // Nothing downstream reads it and it advertises the framework version.
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