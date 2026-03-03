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
import { verifyTOTP, generate2FASessionToken, hashBackupCode } from '@/lib/auth/totp';
import { withSecurityScan } from '@/lib/auth/securityAudit';

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
    const accessToken = cookieStore.get('accessToken')?.value;
    
    // For backup code login, user won't have access token yet
    // They'll have a 2FA session token from initial login
    const totpSecret = secret || cookieStore.get('totpSecret')?.value;

    if (!totpSecret && !backupCode) {
      return NextResponse.json(
        { success: false, error: 'TOTP secret required' },
        { status: 400 }
      );
    }

    let isValid = false;

    // Verify backup code if provided
    if (backupCode) {
      // In production, fetch hashed backup codes from database
      // For now, this is a placeholder
      const hashedBackup = await hashBackupCode(backupCode);
      
      // Check against stored hashed codes (placeholder - would come from DB)
      // const storedHashedCodes = await getStoredHashedBackupCodes(userId);
      // isValid = storedHashedCodes.includes(hashedBackup);
      
      // Placeholder: accept any valid format for dev
      isValid = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(backupCode.toUpperCase());
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

    // Generate 2FA session token (upgrades to full session)
    // In production, would fetch user info from DB
    const sessionToken = generate2FASessionToken('user-id', 'user@example.com');

    const response = withSecurityScan({
      success: true,
      sessionToken,
    }, '/api/auth/2fa/verify');

    return NextResponse.json(response);
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
