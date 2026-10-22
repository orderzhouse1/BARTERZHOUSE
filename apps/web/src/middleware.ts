import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { DEFAULT_LOCALE, isLocale } from '@barterzhouse/shared';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next();
  }

  const segment = pathname.split('/')[1];

  if (!segment) {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}`;
    return NextResponse.redirect(url);
  }

  if (!isLocale(segment)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set('x-barter-locale', segment);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
