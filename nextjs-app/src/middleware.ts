import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_PATHS = ['/home', '/redeem', '/validate', '/stats', '/technician', '/discounts', '/token', '/manage'];

function getProjectRef(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) {
    return null;
  }

  try {
    const host = new URL(supabaseUrl).host;
    const [projectRef] = host.split('.', 1);
    return projectRef || null;
  } catch {
    return null;
  }
}

function hasSupabaseSession(request: NextRequest): boolean {
  const cookieNames = new Set<string>([
    'supabase-auth-token',
    'sb-access-token',
    'sb-refresh-token',
  ]);

  const projectRef = getProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (projectRef) {
    cookieNames.add(`sb-${projectRef}-auth-token`);
    cookieNames.add(`sb-${projectRef}-refresh-token`);
  }

  for (const name of cookieNames) {
    const cookie = request.cookies.get(name);
    if (cookie && typeof cookie.value === 'string' && cookie.value.trim().length > 0) {
      return true;
    }
  }

  return false;
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = hasSupabaseSession(request);

  if (pathname === '/') {
    return hasSession
      ? NextResponse.redirect(new URL('/home', request.url))
      : NextResponse.next();
  }

  if (pathname === '/login' && hasSession) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo') ?? '/home';
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  if (isProtected(pathname) && !hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
