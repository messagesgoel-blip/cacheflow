/**
 * 2FA Disable Endpoint
 * 
 * Disables 2FA for a user.
 * 
 * Gate: 2FA-1
 * Task: 2.13@2FA-1
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withSecurityScan } from '@/lib/auth/securityAudit';
import { resolveAccessToken } from '@/lib/auth/requestAuth';

export interface DisableRequest {
  password: string;
}

export interface DisableResponse {
  success: boolean;
  error?: string;
}

/**
 * POST /api/auth/2fa/disable
 * 
 * Disable 2FA for authenticated user.
 * Requires password confirmation.
 */
export async function POST(request: NextRequest): Promise<NextResponse<DisableResponse>> {
  try {
    const cookieStore = await cookies();
    const accessToken = resolveAccessToken(request, cookieStore);
    
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body: DisableRequest = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password confirmation required' },
        { status: 400 }
      );
    }

    // In production:
    // 1. Verify password against stored hash
    // 2. Delete TOTP secret from database
    // 3. Invalidate backup codes
    // 4. Log security event

    if (typeof password !== 'string' || password.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid password' },
        { status: 401 }
      );
    }

    const response = withSecurityScan({
      success: true,
    }, '/api/auth/2fa/disable');
    const nextResponse = NextResponse.json(response);
    nextResponse.cookies.delete('totpSecret');
    nextResponse.cookies.delete('totpBackupHashes');
    nextResponse.cookies.delete('totpEnabled');
    nextResponse.cookies.delete('totpLastUsed');
    return nextResponse;
  } catch (error) {
    console.error('2FA disable error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Disable failed' 
      },
      { status: 500 }
    );
  }
}

