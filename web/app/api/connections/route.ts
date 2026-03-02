/**
 * Connections API Route
 *
 * Provides unified server-state connections data to frontend components.
 * Reads from backend tokens API to get provider connections.
 *
 * Gate: SYNC-1
 * Task: 1.16@SYNC-1
 */

import { NextRequest, NextResponse } from 'next/server';

// Backend API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface BackendToken {
  provider: string;
  accountId: string;
  accountEmail: string;
  accountLabel: string;
  accountOrder: number;
  isDefault: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  scope: string | null;
  updatedAt: string;
}

interface ProviderConnection {
  id: string;
  provider: string;
  accountName: string;
  accountEmail: string;
  accountLabel: string;
  isDefault: boolean;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: string;
}

/**
 * GET /api/connections
 *
 * Fetches all provider connections from server state (backend API).
 * Returns unified connection list for frontend consumption.
 */
export async function GET(request: NextRequest) {
  try {
    // Get the access token from the request headers (set by auth interceptor)
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');

    if (!authHeader && !cookieHeader) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Call backend API to get tokens
    const backendResponse = await fetch(`${API_BASE}/api/tokens`, {
      headers: {
        ...(authHeader && { Authorization: authHeader }),
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
      credentials: 'include',
    });

    if (!backendResponse.ok) {
      if (backendResponse.status === 401) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Failed to fetch connections from server' },
        { status: backendResponse.status }
      );
    }

    const tokensData = await backendResponse.json();
    const tokens: BackendToken[] = tokensData.tokens || [];

    // Transform tokens to connection format
    const connections: ProviderConnection[] = tokens
      .filter(token => token.accessToken)
      .map(token => {
        // Determine if token is expired
        let status: 'connected' | 'disconnected' | 'error' = 'connected';
        if (token.expiresAt && token.expiresAt < Date.now()) {
          status = 'error'; // Token expired
        }

        return {
          id: token.accountId || `${token.provider}:${token.accountEmail}`,
          provider: token.provider,
          accountName: token.accountEmail.split('@')[0] || token.provider,
          accountEmail: token.accountEmail,
          accountLabel: token.accountLabel,
          isDefault: token.isDefault,
          status,
          lastSyncAt: token.updatedAt,
        };
      });

    return NextResponse.json({
      success: true,
      data: connections,
    });
  } catch (error) {
    console.error('[connections] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve connections' },
      { status: 500 }
    );
  }
}
