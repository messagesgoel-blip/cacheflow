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
import { generateSecret, generateQRCodeDataURI, generateBackupCodes, hashBackupCodes } from '../../../../lib/auth/totp';
import { withSecurityScan } from '../../../../lib/auth/securityAudit';

export interface SetupResponse {
  success: boolean;
  secret?: string;
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
    const accessToken = cookieStore.get('accessToken')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Decode user info from token
    const { verify } = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
    
    let payload: any;
    try {
      payload = verify(accessToken, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Generate TOTP secret
    const secret = generateSecret();
    
    // Generate QR code URL
    const qrCodeUrl = generateQRCodeDataURI(
      'CacheFlow',
      payload.email,
      secret
    );

    // Generate backup codes (store hashed versions)
    const backupCodes = generateBackupCodes(8);
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(code => hashBackupCode(code))
    );

    // In production, store secret and hashed backup codes in database
    // For now, return them to client (they would be stored via a separate call)
    
    const response = withSecurityScan({
      success: true,
      secret,
      qrCodeUrl,
      backupCodes, // Return plain codes for user to save
    }, '/api/auth/2fa/setup');

    return NextResponse.json(response);
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

/**
 * Helper to hash backup codes
 */
async function hashBackupCodes(codes: string[]): Promise<string[]> {
  const { hashBackupCode } = await import('../../../../lib/auth/totp');
  return Promise.all(codes.map(code => hashBackupCode(code)));
}
