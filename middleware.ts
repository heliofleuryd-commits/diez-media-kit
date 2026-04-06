import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || process.env.ADMIN_PASSWORD || 'dev-secret-change-me'
);

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const { pathname } = request.nextUrl;

  const isAdminHost =
    host === 'admin.diez.gg' ||
    host.startsWith('admin.diez.') ||
    // local dev: visit /admin directly
    (process.env.NODE_ENV === 'development' && pathname.startsWith('/admin'));

  if (!isAdminHost) return NextResponse.next();

  // Map subdomain paths → /admin/* internal paths
  const adminPath = pathname === '/' ? '/admin' : `/admin${pathname}`;

  // Allow login page and API through without auth check
  const isLoginPage = adminPath === '/admin/login';
  const isApi = pathname.startsWith('/api/');
  if (isLoginPage || isApi) {
    return NextResponse.rewrite(new URL(adminPath, request.url));
  }

  // Verify auth cookie
  const token = request.cookies.get('admin_token')?.value;
  if (token) {
    try {
      await jwtVerify(token, secret);
      return NextResponse.rewrite(new URL(adminPath, request.url));
    } catch {}
  }

  // Not authenticated → redirect to login
  const loginUrl = new URL('/admin/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
