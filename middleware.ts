import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';
import { canAccessPath, ROLE_HOME, type AppRole } from '@/lib/permissions';

const PUBLIC_PATHS = ['/', '/login', '/register', '/api/auth'];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isAppRole(value: unknown): value is AppRole {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ROLE_HOME, value);
}

async function readSessionToken(req: NextRequest) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  // Auth.js uses a different cookie name when secure cookies are enabled.
  // Trying both keeps local HTTP and deployed HTTPS environments consistent.
  return (
    (await getToken({ req, secret, secureCookie: false })) ??
    (await getToken({ req, secret, secureCookie: true }))
  );
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const publicPath = isPublicPath(pathname);
  const apiPath = pathname.startsWith('/api/');
  const token = await readSessionToken(req);

  if (!token) {
    if (publicPath) return NextResponse.next();
    if (apiPath) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const loginUrl = new URL('/login', req.url);
    if (pathname !== '/') loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === '/login') {
    const role = isAppRole(token.role) ? token.role : null;
    return NextResponse.redirect(new URL(role ? ROLE_HOME[role] : '/', req.url));
  }

  if (publicPath) return NextResponse.next();

  if (!isAppRole(token.role)) {
    if (apiPath) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (!canAccessPath(token.role, pathname)) {
    if (apiPath) return NextResponse.json({ error: 'Forbidden for your role' }, { status: 403 });
    return NextResponse.redirect(new URL(ROLE_HOME[token.role], req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
