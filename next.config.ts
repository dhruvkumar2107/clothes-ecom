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
  },
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