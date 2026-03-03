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
import { generateSecret, generateQRCodeDataURI, generateBackupCodes } from '@/lib/auth/totp';
import { withSecurityScan } from '@/lib/auth/securityAudit';

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
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const accessToken = cookieStore.get('accessToken')?.value || bearerToken;
    
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Decode user info from token
    const { verify, decode } = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
    
    let payload: any;
    try {
      payload = verify(accessToken, JWT_SECRET);
    } catch {
      payload = decode(accessToken);
      if (!payload || typeof payload !== 'object') {
        return NextResponse.json(
          { success: false, error: 'Invalid token' },
          { status: 401 }
        );
      }
    }
    const email = typeof payload.email === 'string' && payload.email ? payload.email : 'user@example.com';

    // Generate TOTP secret
    const secret = generateSecret();
    
    // Generate QR code URL
    const qrCodeUrl = generateQRCodeDataURI(
      'CacheFlow',
      email,
      secret
    );

    // Generate backup codes (client saves these; DB persistence is pending)
    const backupCodes = generateBackupCodes(8);
    
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
