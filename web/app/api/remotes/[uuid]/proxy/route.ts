/**
 * Remote Proxy Endpoint
 * 
 * Proxies requests to external provider APIs with proper auth handling.
 * Implements single refresh+retry flow to prevent refresh loops.
 * 
 * Gate: HOLD-UI
 * Task: UI-P1-T02@HOLD-UI-2026-03-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sign, verify } from 'jsonwebtoken';
import { withSecurityScan } from '../../../../lib/auth/securityAudit';

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-secret' : '');

interface ProxyRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

interface ProxyResponse {
  success: boolean;
  data?: any;
  error?: string;
  requiresReauth?: boolean;
}

/**
 * Singleton refresh promise - prevents concurrent refresh loops
 */
let refreshPromise: Promise<string> | null = null;

async function refreshAuthToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8100'}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      const data = await response.json();
      return data.accessToken;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * POST /api/remotes/[uuid]/proxy
 * 
 * Proxy a request to an external provider API.
 * Handles 401 with single refresh+retry, then explicit re-auth fallback.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { uuid: string } }
): Promise<NextResponse<ProxyResponse>> {
  const { uuid } = params;

  try {
    const cookieStore = await cookies();
    let accessToken = cookieStore.get('accessToken')?.value;

    // Parse proxy request
    const proxyReq: ProxyRequest = await request.json();
    const { method, url, headers, body } = proxyReq;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Target URL required' },
        { status: 400 }
      );
    }

    // First attempt with current token
    let response = await makeProxyRequest(url, method, headers, body, accessToken);

    // Handle 401 - single refresh+retry
    if (response.status === 401) {
      try {
        // Refresh token once
        accessToken = await refreshAuthToken();
        
        // Retry with new token
        response = await makeProxyRequest(url, method, headers, body, accessToken);

        // Still 401 after refresh - require re-auth
        if (response.status === 401) {
          return NextResponse.json({
            success: false,
            error: 'Authentication expired. Please sign in again.',
            requiresReauth: true,
          }, { status: 401 });
        }
      } catch (refreshError) {
        // Refresh failed - require re-auth
        console.error('Token refresh failed:', refreshError);
        return NextResponse.json({
          success: false,
          error: 'Session expired. Please sign in again.',
          requiresReauth: true,
        }, { status: 401 });
      }
    }

    // Parse response
    let responseData;
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }

    // Security scan
    const safeResponse = withSecurityScan({
      success: response.ok,
      data: responseData,
    }, `/api/remotes/${uuid}/proxy`);

    return NextResponse.json(safeResponse, {
      status: response.ok ? 200 : response.status,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Proxy request failed',
      },
      { status: 500 }
    );
  }
}

/**
 * Make the actual proxy request to external API
 */
async function makeProxyRequest(
  url: string,
  method: string,
  headers: Record<string, string> = {},
  body: any,
  accessToken?: string
): Promise<Response> {
  const proxyHeaders: Record<string, string> = {
    ...headers,
  };

  // Add auth header if token provided
  if (accessToken) {
    proxyHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  const fetchOptions: RequestInit = {
    method,
    headers: proxyHeaders,
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  return fetch(url, fetchOptions);
}
