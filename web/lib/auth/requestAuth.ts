/**
 * Request Authentication Utilities
 *
 * SEC-1 / AUTH-2 hardening (1.18@SEC-1, 1.18@AUTH-2):
 * - JWT_SECRET is required; missing secret is a hard failure in all environments.
 * - decodeAuthPayload always verifies signature — never falls back to decode()
 *   without verification.  Accepting an unverified token is an auth-bypass.
 */

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

/**
 * Verify and decode an access token.
 *
 * SECURITY: JWT_SECRET must be set.  If it is absent we refuse to proceed
 * rather than falling back to decode() (unverified), which would allow any
 * attacker-crafted JWT to pass authentication.
 *
 * Returns null on any failure (missing secret, invalid signature, expired).
 */
export async function decodeAuthPayload(token: string): Promise<AuthPayload | null> {
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    // Hard failure: do not fall back to decode() — that bypasses signature verification.
    console.error('[AUTH] JWT_SECRET is not set; refusing to verify token without secret.');
    return null;
  }

  const { verify } = await import('jsonwebtoken');

  try {
    const payload = verify(token, jwtSecret);
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const id = typeof payload.id === 'string' || typeof payload.id === 'number' ? payload.id : undefined;
    const email = typeof payload.email === 'string' ? payload.email : undefined;
    return { id, email };
  } catch {
    // Invalid signature, expired, malformed — all treated as unauthenticated.
    return null;
  }
}

