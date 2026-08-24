import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/auth/jwt';

/**
 * Edge-compatible middleware.
 *
 * IMPORTANT: This file MUST NOT import anything that pulls in @prisma/client
 * (e.g. @/lib/db, @/lib/rate-limit, @/lib/auth/session) because Prisma's
 * query engine cannot run in the Edge runtime. Rate limiting that requires
 * DB access is handled inside the API route handlers instead.
 */

const ADMIN_PATHS = ['/admin', '/api/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and public files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/img') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/manifest.json'
  ) {
    return NextResponse.next();
  }

  // Check session token (uses only `jose` — Edge-compatible)
  const token = request.cookies.get('lmn_session')?.value;
  const session = await verifySessionToken(token, 'customer');

  const isAdmin = ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  // Admin routes — require staff session
  if (isAdmin) {
    const staffToken = request.cookies.get('lmn_staff_session')?.value;
    const staffSession = await verifySessionToken(staffToken, 'staff');
    if (!staffSession) {
      // Not authenticated as staff → redirect to login
      const url = new URL('/login', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    const response = NextResponse.next();
    response.headers.set('x-staff-id', staffSession.sub);
    response.headers.set('x-staff-role', staffSession.role || 'staff');
    return response;
  }

  // Redirect authenticated users away from auth pages
  if (session && (pathname === '/login' || pathname === '/signup')) {
    const redirect =
      request.nextUrl.searchParams.get('redirect') || '/account';
    return NextResponse.redirect(new URL(redirect, request.url));
  }

  // Protect account routes
  if (pathname.startsWith('/account') && !session) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Attach session info to downstream handlers via headers
  const response = NextResponse.next();
  if (session) {
    response.headers.set('x-user-id', session.sub);
    response.headers.set('x-user-email', session.email || '');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
};