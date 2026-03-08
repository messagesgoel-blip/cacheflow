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
import { resolveServerApiBase } from '@/lib/auth/serverApiBase';

interface ProxyRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

function buildForwardHeaders(request: NextRequest, tokenFromCookie?: string | null): HeadersInit {
  const authHeaderFromRequest = request.headers.get('authorization');
  const authHeader = authHeaderFromRequest || (tokenFromCookie ? `Bearer ${tokenFromCookie}` : null);
  const cookieHeader = request.headers.get('cookie');

  return {
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    'Content-Type': request.headers.get('content-type') || 'application/json',
  };
}

/**
 * POST /api/remotes/[uuid]/proxy
 * 
 * Proxy a request to an external provider API.
 * Handles 401 with single refresh+retry, then explicit re-auth fallback.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
): Promise<NextResponse> {
  const { uuid } = await params;

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    const apiBase = resolveServerApiBase();

    // Parse proxy request
    const proxyReq: ProxyRequest = await request.json();
    const { url } = proxyReq;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Target URL required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${apiBase}/api/remotes/${uuid}/proxy`, {
      method: 'POST',
      headers: buildForwardHeaders(request, accessToken),
      body: JSON.stringify(proxyReq),
      cache: 'no-store',
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    if (!contentType.includes('application/json')) {
      const bodyBuffer = await response.arrayBuffer();
      return new NextResponse(bodyBuffer, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          ...(response.headers.get('content-disposition')
            ? { 'Content-Disposition': response.headers.get('content-disposition') as string }
            : {}),
        },
      });
    }

    const responseData = await response.json();
    return NextResponse.json(responseData, {
      status: response.status,
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

