/**
 * 2FA Verify Endpoint
 * 
 * Verifies TOTP code during setup or login.
 * 
 * Gate: 2FA-1
 * Task: 2.13@2FA-1
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyTOTP, generate2FASessionToken, verify2FASessionToken, verifyBackupCode } from '@/lib/auth/totp';
import { decodeAuthPayload, resolveAccessToken } from '@/lib/auth/requestAuth';

export interface VerifyRequest {
  code: string;
  secret?: string; // For setup verification
  backupCode?: string; // For backup code login
}

export interface VerifyResponse {
  success: boolean;
  sessionToken?: string;
  error?: string;
  requiresBackup?: boolean;
}

/**
 * POST /api/auth/2fa/verify
 * 
 * Verify TOTP code for setup completion or login.
 */
export async function POST(request: NextRequest): Promise<NextResponse<VerifyResponse>> {
  try {
    const body: VerifyRequest = await request.json();
    const { code, secret, backupCode } = body;

    if (!code && !backupCode) {
      return NextResponse.json(
        { success: false, error: 'Code or backup code required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const accessToken = resolveAccessToken(request, cookieStore);
    
    const totpSecret = secret || cookieStore.get('totpSecret')?.value;
    const backupHashesRaw = cookieStore.get('totpBackupHashes')?.value;
    let backupHashes: string[] = [];
    if (backupHashesRaw) {
      try {
        const parsed = JSON.parse(backupHashesRaw);
        backupHashes = Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === 'string') : [];
      } catch {
        backupHashes = [];
      }
    }

    if (!accessToken && secret) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!totpSecret && !backupCode) {
      return NextResponse.json(
        { success: false, error: 'TOTP secret required' },
        { status: 400 }
      );
    }

    let isValid = false;

    // Verify backup code if provided
    if (backupCode) {
      isValid = backupHashes.length > 0
        ? await verifyBackupCode(backupCode, backupHashes)
        : false;
    } 
    // Verify TOTP code
    else if (totpSecret) {
      isValid = await verifyTOTP(totpSecret, code);
    }

    if (!isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid code. Please try again.',
          requiresBackup: true, // Offer backup code option
        },
        { status: 401 }
      );
    }

    const authPayload = accessToken ? await decodeAuthPayload(accessToken) : null;
    if (accessToken && secret && !authPayload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const pendingToken = cookieStore.get('sessionToken')?.value;
    const pendingPayload = pendingToken ? verify2FASessionToken(pendingToken) : null;
    const userId = authPayload?.id ?? pendingPayload?.userId;
    const email = authPayload?.email ?? pendingPayload?.email;
    const responsePayload: VerifyResponse = { success: true };
    if (userId && email) {
      responsePayload.sessionToken = generate2FASessionToken(String(userId), email);
    }

    const response = NextResponse.json(responsePayload);
    if (backupCode && backupHashes.length > 0) {
      const updatedHashes: string[] = [];
      let consumed = false;
      for (const hash of backupHashes) {
        const isMatch = await verifyBackupCode(backupCode, [hash]);
        if (isMatch && !consumed) {
          consumed = true;
        } else {
          updatedHashes.push(hash);
        }
      }
      response.cookies.set('totpBackupHashes', JSON.stringify(updatedHashes), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });
    }
    response.cookies.set('totpEnabled', '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });
    response.cookies.set('totpLastUsed', new Date().toISOString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });
    if (totpSecret) {
      response.cookies.set('totpSecret', totpSecret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });
    }
    return response;
  } catch (error) {
    console.error('2FA verify error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Verification failed' 
      },
      { status: 500 }
    );
  }
}

