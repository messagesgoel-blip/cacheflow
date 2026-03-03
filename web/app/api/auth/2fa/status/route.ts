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

export interface TwoFAStatusResponse {
  enabled: boolean;
  backupCodesRemaining?: number;
  error?: string;
}

/**
 * GET /api/auth/2fa/status
 */
export async function GET(request: NextRequest): Promise<NextResponse<TwoFAStatusResponse>> {
  try {
    const cookieStore = await cookies();
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const accessToken = cookieStore.get('accessToken')?.value || bearerToken;

    if (!accessToken) {
      return NextResponse.json(
        { enabled: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Placeholder until DB persistence lands for 2FA state.
    return NextResponse.json({ enabled: false, backupCodesRemaining: 0 });
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
