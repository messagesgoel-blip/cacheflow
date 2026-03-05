/**
 * Silent Token Refresh Endpoint
 * 
 * Handles automatic token refresh using HttpOnly refresh token cookie.
 * Returns new access token without exposing refresh token to client.
 * 
 * Gate: AUTH-2
 * Task: 1.2@AUTH-2, 1.18@AUTH-2
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sign, verify } from 'jsonwebtoken';

// SECURITY (1.18@AUTH-2): Require JWT_SECRET at runtime; avoid module-level throw during build
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('JWT_SECRET not set - using dev-only generated secret. DO NOT USE IN PRODUCTION.');
}

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

interface TokenPayload {
  id?: string;
  userId?: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Get JWT secret - throws in production if not configured
 */
function getJwtSecret(): string {
  const secret = JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-secret-do-not-use-in-prod' : '');
  
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }
  
  return secret;
}

/**
 * Generate new access token
 */
function generateAccessToken(payload: TokenPayload): string {
  return sign(payload, getJwtSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * Verify and decode refresh token
 */
function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return verify(token, getJwtSecret()) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/refresh
 * 
 * Expects: HttpOnly refresh token cookie
 * Returns: New access token (refresh token rotated)
 */
export async function POST(request: NextRequest) {
  try {
    // Security check: ensure secret is configured
    const secret = getJwtSecret();
    if (!secret) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const refreshToken = cookieStore.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'No refresh token provided' },
        { status: 401 }
      );
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    const userId = payload.id || payload.userId;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Invalid refresh token payload' },
        { status: 401 }
      );
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      id: userId,
      userId,
      email: payload.email,
    });

    // Generate new refresh token (rotation)
    const newRefreshToken = sign(
      { id: userId, userId, email: payload.email },
      getJwtSecret(),
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    // Create response with new tokens
    const response = NextResponse.json({
      success: true,
      accessToken: newAccessToken,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    });

    // Set new refresh token as HttpOnly cookie
    response.cookies.set('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { success: false, error: 'Token refresh failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/refresh
 * 
 * Health check endpoint
 */
export async function GET() {
  const isConfigured = !!JWT_SECRET || process.env.NODE_ENV !== 'production';
  
  return NextResponse.json({
    success: true,
    endpoint: '/api/auth/refresh',
    status: 'active',
    configured: isConfigured,
  });
}
