import { NextRequest, NextResponse } from 'next/server';
import {
  isAuthConfigured,
  SESSION_COOKIE,
  verifySessionToken,
} from '@/lib/auth/session';

const PUBLIC_API_PATHS = new Set(['/api/health', '/api/ready', '/api/status']);

function isPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    PUBLIC_API_PATHS.has(pathname)
  );
}

export async function proxy(request: NextRequest) {
  // Preserve the repository's zero-config demo experience. Production becomes
  // protected as soon as both JWT_SECRET and PASSWORD_HASH are configured.
  if (!isAuthConfigured()) return NextResponse.next();

  const pathname = request.nextUrl.pathname;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await verifySessionToken(token);

  if (pathname === '/login') {
    return authenticated
      ? NextResponse.redirect(new URL('/dashboard', request.url))
      : NextResponse.next();
  }

  if (isPublicPath(pathname)) return NextResponse.next();
  if (authenticated) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
