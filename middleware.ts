import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CUSTOMER_COOKIE = 'lmn_session';
const STAFF_COOKIE = 'lmn_staff';

const ACCOUNT_PREFIX = '/account';
const ADMIN_PREFIX = '/admin';
const ADMIN_LOGIN = '/admin/login';
const LOGIN = '/login';
const SIGNUP = '/signup';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCustomerCookie = request.cookies.has(CUSTOMER_COOKIE);
  const hasStaffCookie = request.cookies.has(STAFF_COOKIE);

  // Protect account routes — require customer cookie
  if (pathname.startsWith(ACCOUNT_PREFIX)) {
    if (!hasCustomerCookie) {
      const url = new URL(LOGIN, request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Protect admin routes — require staff cookie
  if (pathname.startsWith(ADMIN_PREFIX) && pathname !== ADMIN_LOGIN) {
    if (!hasStaffCookie) {
      const url = new URL(ADMIN_LOGIN, request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Redirect authenticated customers away from auth pages
  if ((pathname === LOGIN || pathname === SIGNUP) && hasCustomerCookie) {
    return NextResponse.redirect(new URL(ACCOUNT_PREFIX, request.url));
  }

  // Redirect authenticated staff away from admin login
  if (pathname === ADMIN_LOGIN && hasStaffCookie) {
    return NextResponse.redirect(new URL(ADMIN_PREFIX, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/account/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
  ],
};