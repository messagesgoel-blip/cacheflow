import { NextRequest, NextResponse } from 'next/server';
import { sign } from 'jsonwebtoken';

const DEFAULT_API_BASE = 'http://127.0.0.1:8100';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function isLoopbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

function resolveApiBase(): string {
  const candidates = [
    process.env.API_INTERNAL_URL,
    process.env.CACHEFLOW_API_INTERNAL_URL,
    process.env.API_URL,
    process.env.NEXT_PUBLIC_API_URL,
    DEFAULT_API_BASE,
    'http://localhost:8100',
  ].filter(Boolean) as string[];

  const nonLoopback = candidates.find((candidate) => !isLoopbackUrl(candidate));
  const selected = nonLoopback || candidates[0] || DEFAULT_API_BASE;
  return normalizeBaseUrl(selected);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body || {};
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'email and password required' },
        { status: 400 }
      );
    }

    const apiBase = resolveApiBase();
    const backendResponse = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });

    const payload = await backendResponse.json().catch(() => ({}));
    if (!backendResponse.ok) {
      return NextResponse.json(
        { success: false, error: payload?.error || 'Login failed' },
        { status: backendResponse.status }
      );
    }

    const token = payload?.token;
    const user = payload?.user || { email };
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Login succeeded but no token was returned' },
        { status: 502 }
      );
    }

    const response = NextResponse.json({
      success: true,
      token,
      user,
    });

    const isProd = process.env.NODE_ENV === 'production';
    response.cookies.set('accessToken', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    const jwtSecret = process.env.JWT_SECRET;
    const userId = user?.id;
    if (jwtSecret && userId) {
      const refreshToken = sign(
        { id: userId, userId, email: user?.email || email },
        jwtSecret,
        { expiresIn: '7d' }
      );
      response.cookies.set('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60,
      });
    }

    response.cookies.set(
      'userData',
      JSON.stringify({ id: user?.id ?? null, email: user?.email || email }),
      {
        httpOnly: false,
        secure: isProd,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
      }
    );

    return response;
  } catch (error) {
    console.error('[auth/login] proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}
