import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verify } from 'jsonwebtoken';
import { resolveServerApiBase } from '@/lib/auth/serverApiBase';

interface SessionPayload {
  id?: string | number;
  userId?: string | number;
  email?: string;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    const userDataCookie = cookieStore.get('userData')?.value;

    if (!accessToken) {
      return NextResponse.json({
        authenticated: false,
        error: 'No active session',
      });
    }

    const secret = process.env.JWT_SECRET;
    if (secret) {
      try {
        const payload = verify(accessToken, secret) as SessionPayload;
        const id = payload?.id ?? payload?.userId ?? null;
        const email = payload?.email ?? '';

        return NextResponse.json({
          authenticated: true,
          user: { id, email },
        });
      } catch {
        // Fall through to backend verification.
      }
    }

    try {
      const apiBase = resolveServerApiBase();
      const backendResponse = await fetch(`${apiBase}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (backendResponse.ok) {
        const payload = await backendResponse.json().catch(() => ({}));
        const user = payload?.user ?? null;
        return NextResponse.json({
          authenticated: true,
          user: {
            id: user?.id ?? null,
            email: user?.email ?? '',
          },
        });
      }
    } catch {
      // Fall through to cookie fallback below.
    }

    if (userDataCookie) {
      try {
        const parsed = JSON.parse(userDataCookie);
        return NextResponse.json({
          authenticated: true,
          user: {
            id: parsed?.id ?? null,
            email: parsed?.email ?? '',
          },
        });
      } catch {
        // Ignore malformed cookie.
      }
    }

    return NextResponse.json(
      { authenticated: false, error: 'Server auth configuration missing' },
      { status: 500 }
    );
  } catch {
    return NextResponse.json({
      authenticated: false,
      error: 'Invalid or expired session',
    });
  }
}
