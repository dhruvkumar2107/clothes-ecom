import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lumenandco.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/products', '/collections', '/search'],
        disallow: ['/admin', '/api', '/account', '/cart', '/checkout', '/login', '/signup', '/_next', '/private'],
      },
      {
        userAgent: 'Googlebot',
        allow: ['/', '/products', '/collections', '/search'],
        disallow: ['/admin', '/api', '/account', '/cart', '/checkout', '/_next', '/private'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}