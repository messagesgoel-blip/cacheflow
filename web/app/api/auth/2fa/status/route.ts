/**
 * 2FA Status Endpoint
 *
 * Returns current 2FA status for an authenticated user.
 *
 * Gate: 2FA-1
 * Task: 2.13@2FA-1
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveAccessToken } from '@/lib/auth/requestAuth';

export interface TwoFAStatusResponse {
  enabled: boolean;
  lastUsed?: string;
  backupCodesRemaining?: number;
  error?: string;
}

/**
 * GET /api/auth/2fa/status
 */
export async function GET(request: NextRequest): Promise<NextResponse<TwoFAStatusResponse>> {
  try {
    const cookieStore = await cookies();
    const accessToken = resolveAccessToken(request, cookieStore);

    if (!accessToken) {
      return NextResponse.json(
        { enabled: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    let backupCodesRemaining = 0;
    try {
      const raw = cookieStore.get('totpBackupHashes')?.value;
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        backupCodesRemaining = parsed.length;
      }
    } catch {
      backupCodesRemaining = 0;
    }

    return NextResponse.json({
      enabled: cookieStore.get('totpEnabled')?.value === '1',
      lastUsed: cookieStore.get('totpLastUsed')?.value,
      backupCodesRemaining,
    });
  } catch (error) {
    return NextResponse.json(
      {
        enabled: false,
        error: error instanceof Error ? error.message : 'Failed to load 2FA status',
      },
      { status: 500 }
    );
  }
}

