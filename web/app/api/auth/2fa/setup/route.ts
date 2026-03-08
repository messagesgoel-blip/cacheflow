/**
 * 2FA Setup Endpoint
 * 
 * Initiates TOTP setup for a user.
 * Returns secret and QR code data.
 * 
 * Gate: 2FA-1
 * Task: 2.13@2FA-1
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { generateSecret, generateQRCodeDataURI, generateBackupCodes, hashBackupCode } from '@/lib/auth/totp';
import { withSecurityScan } from '@/lib/auth/securityAudit';
import { decodeAuthPayload, resolveAccessToken } from '@/lib/auth/requestAuth';

export interface SetupResponse {
  success: boolean;
  qrCodeUrl?: string;
  backupCodes?: string[];
  error?: string;
}

/**
 * POST /api/auth/2fa/setup
 * 
 * Generate TOTP secret and QR code for user.
 */
export async function POST(request: NextRequest): Promise<NextResponse<SetupResponse>> {
  try {
    const cookieStore = await cookies();
    const accessToken = resolveAccessToken(request, cookieStore);
    
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const payload = await decodeAuthPayload(accessToken);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }
    const email = payload.email || 'user@example.com';

    // Generate TOTP secret
    const secret = generateSecret();
    
    // Generate QR code URL
    const qrCodeUrl = generateQRCodeDataURI(
      'CacheFlow',
      email,
      secret
    );

    // Generate backup codes and keep only hashes server-side.
    const backupCodes = generateBackupCodes(8);
    const backupCodeHashes = await Promise.all(backupCodes.map(code => hashBackupCode(code)));
    
    const responsePayload = withSecurityScan({
      success: true,
      qrCodeUrl,
      backupCodes, // Return plain codes for user to save
    }, '/api/auth/2fa/setup');
    const response = NextResponse.json(responsePayload);
    response.cookies.set('totpSecret', secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/',
    });
    response.cookies.set('totpBackupHashes', JSON.stringify(backupCodeHashes), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('2FA setup error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Setup failed' 
      },
      { status: 500 }
    );
  }
}

