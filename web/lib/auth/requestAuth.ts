import { NextRequest } from 'next/server';

interface CookieValue {
  value: string;
}

interface CookieStoreLike {
  get(name: string): CookieValue | undefined;
}

export interface AuthPayload {
  id?: string | number;
  email?: string;
}

export function resolveAccessToken(request: NextRequest, cookieStore: CookieStoreLike): string | null {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  return cookieStore.get('accessToken')?.value || bearerToken;
}

export async function decodeAuthPayload(token: string): Promise<AuthPayload | null> {
  const jwtSecret = process.env.JWT_SECRET;
  const { verify, decode } = await import('jsonwebtoken');

  try {
    const payload = jwtSecret ? verify(token, jwtSecret) : decode(token);
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const id = typeof payload.id === 'string' || typeof payload.id === 'number' ? payload.id : undefined;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    return { id, email };
  } catch {
    const payload = decode(token);
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const id = typeof payload.id === 'string' || typeof payload.id === 'number' ? payload.id : undefined;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    return { id, email };
  }
}
