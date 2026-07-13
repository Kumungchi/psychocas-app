import { convexAuthNextjsMiddleware } from '@convex-dev/auth/nextjs/server';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { isProtectedPath } from '@/lib/auth/routePolicy';
import { convexUrl } from '@/lib/convex/config';
import { sanitizeRedirect } from '@/lib/navigation/redirect';

const AUTH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function routeWithSession(
  request: NextRequest,
  hasSession: boolean,
) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    return hasSession
      ? NextResponse.redirect(new URL('/home', request.url))
      : NextResponse.next();
  }

  if (pathname === '/login' && hasSession) {
    const requestedRedirect = sanitizeRedirect(request.nextUrl.searchParams.get('redirectTo'));
    return NextResponse.redirect(new URL(requestedRedirect, request.url));
  }

  if (isProtectedPath(pathname) && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

const convexProxy = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) =>
    routeWithSession(request, await convexAuth.isAuthenticated()),
  {
    convexUrl,
    apiRoute: '/api/auth',
    cookieConfig: { maxAge: AUTH_COOKIE_MAX_AGE_SECONDS },
    shouldHandleCode: false,
  },
);

export function proxy(request: NextRequest, event: NextFetchEvent) {
  return convexProxy(request, event);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
