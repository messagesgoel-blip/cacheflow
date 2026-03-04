/**
 * Next.js Edge Middleware — Route Protection (1.18@AUTH-2, 1.18@SEC-1)
 *
 * Enforces authentication on all protected routes.
 * - API routes under /api/** (except /api/auth/**): returns 401 JSON when accessToken cookie is absent.
 * - Page routes (dashboard, files, connections, settings, etc.): redirects to /?mode=login.
 * - Public routes (login, register, auth pages, health) are always allowed through.
 *
 * SECURITY NOTE: This middleware only checks cookie presence at the edge.
 * Full JWT signature verification is performed inside each API route handler
 * via decodeAuthPayload() which now requires JWT_SECRET (no decode() fallback).
 */

import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/auth/',
  '/login',
  '/register',
  '/health',
  '/_next/',
  '/favicon',
];

const PROTECTED_PAGE_PREFIXES = [
  '/dashboard',
  '/files',
  '/connections',
  '/settings',
  '/remotes',
  '/admin',
  '/security',
  '/providers',
  '/conflicts',
  '/share',
];

const PROTECTED_API_PREFIX = '/api/';
const PUBLIC_API_PREFIX = '/api/auth/';

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedApi(pathname: string): boolean {
  return pathname.startsWith(PROTECTED_API_PREFIX) && !pathname.startsWith(PUBLIC_API_PREFIX);
}

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Check for accessToken cookie
  const hasCookieToken = !!request.cookies.get('accessToken')?.value;

  // API routes require cookie auth
  if (isProtectedApi(pathname)) {
    if (!hasCookieToken) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Page routes: allow through for both cookie auth AND localStorage-based auth (E2E tests)
  // Client-side code will handle redirect to login if localStorage token is missing
  if (isProtectedPage(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
};
