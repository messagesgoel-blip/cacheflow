/**
 * Connections API Route
 *
 * Provides unified server-state connections data to frontend components.
 * Reads from backend remotes API to get provider connections.
 * Includes explicit error surfaces for failed sync/proxy/favorites requests.
 *
 * Gate: SYNC-1
 * Task: 1.16@SYNC-1
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

interface BackendRemote {
  id: string;
  provider: string;
  account_key?: string;
  account_id?: string;
  account_email?: string;
  display_name?: string;
  expires_at?: string;
  disabled?: boolean;
  updated_at?: string;
}

interface ProviderConnection {
  id: string;
  provider: string;
  accountKey: string;
  accountId?: string;
  remoteId: string;
  accountName: string;
  accountEmail: string;
  accountLabel: string;
  isDefault: boolean;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: string;
  host?: string;
  port?: number;
  username?: string;
  lastTestedAt?: string;
  lastHostFingerprint?: string;
}

interface BackendVpsConnection {
  id: string;
  provider: 'vps';
  label: string;
  host: string;
  port: number;
  username: string;
  authMethod: string;
  createdAt?: string;
  updatedAt?: string;
  lastTestedAt?: string;
  lastHostFingerprint?: string;
}

// Types for explicit error surfaces
interface SyncRequestError {
  type: 'sync';
  message: string;
  provider?: string;
  operation?: string;
  details?: any;
}

interface ProxyRequestError {
  type: 'proxy';
  message: string;
  url?: string;
  provider?: string;
  details?: any;
}

interface FavoritesRequestError {
  type: 'favorites';
  message: string;
  operation?: string;
  details?: any;
}

type RequestError = SyncRequestError | ProxyRequestError | FavoritesRequestError;

const DEFAULT_API_BASE = 'http://127.0.0.1:8100';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function isLoopbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

function resolveApiBase(): string {
  const candidates = [
    process.env.API_INTERNAL_URL,
    process.env.CACHEFLOW_API_INTERNAL_URL,
    process.env.API_URL,
    DEFAULT_API_BASE,
    process.env.NEXT_PUBLIC_API_URL,
    'http://localhost:8100',
  ].filter(Boolean) as string[];

  const nonLoopback = candidates.find((candidate) => !isLoopbackUrl(candidate));
  const selected = nonLoopback || candidates[0] || DEFAULT_API_BASE;
  return normalizeBaseUrl(selected);
}

function extractRemotes(payload: any): BackendRemote[] {
  if (Array.isArray(payload?.remotes)) return payload.remotes;
  if (Array.isArray(payload?.data?.remotes)) return payload.data.remotes;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function normalizeProviderId(provider: string): string {
  if (provider === 'google_drive') return 'google';
  return provider;
}

function mapRemoteToConnection(remote: BackendRemote): ProviderConnection {
  const accountKey = remote.account_key || remote.account_id || remote.id;
  const expiresAt = remote.expires_at ? new Date(remote.expires_at).getTime() : null;
  const isExpired = expiresAt !== null && expiresAt < Date.now();

  let status: 'connected' | 'disconnected' | 'error' = 'connected';
  if (remote.disabled) status = 'disconnected';
  else if (isExpired) status = 'error';

  const accountLabel = remote.display_name || accountKey;
  const accountEmail = remote.account_email || '';

  return {
    id: remote.id,
    provider: normalizeProviderId(remote.provider),
    accountKey,
    accountId: remote.account_id,
    remoteId: remote.id,
    accountName: accountLabel,
    accountEmail,
    accountLabel,
    isDefault: false,
    status,
    lastSyncAt: remote.updated_at,
  };
}

function mapVpsToConnection(vps: BackendVpsConnection): ProviderConnection {
  return {
    id: vps.id,
    provider: 'vps',
    accountKey: vps.id,
    remoteId: vps.id,
    accountName: vps.label,
    accountEmail: '',
    accountLabel: vps.label,
    isDefault: false,
    status: 'connected',
    lastSyncAt: vps.updatedAt || vps.createdAt,
    host: vps.host,
    port: vps.port,
    username: vps.username,
    lastTestedAt: vps.lastTestedAt,
    lastHostFingerprint: vps.lastHostFingerprint,
  };
}

/**
 * GET /api/connections
 *
 * Fetches all provider connections from server state (backend API).
 * Returns unified connection list for frontend consumption.
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const tokenFromCookie = cookieStore.get('accessToken')?.value;
    const authHeaderFromRequest = request.headers.get('authorization');
    const authHeader = authHeaderFromRequest || (tokenFromCookie ? `Bearer ${tokenFromCookie}` : null);
    const cookieHeader = request.headers.get('cookie');

    if (!authHeader && !cookieHeader) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const apiBase = resolveApiBase();
    const backendResponse = await fetch(`${apiBase}/api/remotes`, {
      headers: {
        ...(authHeader && { Authorization: authHeader }),
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
      credentials: 'include',
      cache: 'no-store',
    });

    if (!backendResponse.ok) {
      if (backendResponse.status === 401) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Unauthorized',
            requestError: {
              type: 'sync',
              message: 'Authentication failed when fetching provider connections',
              operation: 'GET /api/remotes'
            } as SyncRequestError
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to fetch connections from server',
          requestError: {
            type: 'sync',
            message: `Failed to fetch connections from server. Status: ${backendResponse.status}`,
            operation: 'GET /api/remotes',
            details: {
              statusCode: backendResponse.status,
              statusText: backendResponse.statusText
            }
          } as SyncRequestError
        },
        { status: backendResponse.status }
      );
    }

    const payload = await backendResponse.json();
    const remotes = extractRemotes(payload);
    const connections = remotes.map(mapRemoteToConnection);

    try {
      const vpsResponse = await fetch(`${apiBase}/api/providers/vps`, {
        headers: {
          ...(authHeader && { Authorization: authHeader }),
          ...(cookieHeader && { Cookie: cookieHeader }),
        },
        credentials: 'include',
        cache: 'no-store',
      });

      if (vpsResponse.ok) {
        const vpsPayload = await vpsResponse.json();
        const rawVps = Array.isArray(vpsPayload?.data) ? vpsPayload.data : [];
        const vpsConnections = rawVps.map(mapVpsToConnection);
        connections.push(...vpsConnections);
      }
    } catch {
      // VPS listing is best-effort so providers page remains usable.
    }

    // FIX-06: Enforce stable sort
    connections.sort((a, b) => {
      const timeA = a.lastSyncAt ? new Date(a.lastSyncAt).getTime() : 0;
      const timeB = b.lastSyncAt ? new Date(b.lastSyncAt).getTime() : 0;
      return timeA - timeB || a.id.localeCompare(b.id);
    });

    return NextResponse.json({
      success: true,
      data: connections,
    });
  } catch (error: any) {
    console.error('[connections] GET error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve connections',
        requestError: {
          type: 'sync',
          message: error.message || 'Unknown error occurred during connection retrieval',
          operation: 'GET /api/remotes',
          details: {
            error: error.message,
            stack: error.stack
          }
        } as SyncRequestError
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/connections/test-proxy
 *
 * Test endpoint for proxy requests with explicit error surfaces
 */
export async function POST(request: NextRequest) {
  try {
    const { url, method = 'GET', headers, body } = await request.json();

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: 'URL is required for proxy requests',
          requestError: {
            type: 'proxy',
            message: 'URL parameter is missing for proxy request',
            operation: 'POST /api/connections/test-proxy'
          } as ProxyRequestError
        },
        { status: 400 }
      );
    }

    // Perform proxy request
    const proxyResponse = await fetch(url, {
      method,
      headers: headers || {},
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });

    if (!proxyResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Proxy request failed with status ${proxyResponse.status}`,
          requestError: {
            type: 'proxy',
            message: `Proxy request failed. Status: ${proxyResponse.status}`,
            url,
            operation: 'POST /api/connections/test-proxy',
            details: {
              statusCode: proxyResponse.status,
              statusText: proxyResponse.statusText
            }
          } as ProxyRequestError
        },
        { status: proxyResponse.status }
      );
    }

    const responseData = await proxyResponse.json();
    
    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    console.error('[connections] POST proxy error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Proxy request failed',
        requestError: {
          type: 'proxy',
          message: error.message || 'Unknown error occurred during proxy request',
          operation: 'POST /api/connections/test-proxy',
          details: {
            error: error.message,
            stack: error.stack
          }
        } as ProxyRequestError
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/connections/favorites
 *
 * Test endpoint for favorites requests with explicit error surfaces
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authorization required for favorites operations',
          requestError: {
            type: 'favorites',
            message: 'Missing authorization header for favorites operation',
            operation: 'PUT /api/connections/favorites'
          } as FavoritesRequestError
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, fileId, provider, accountKey } = body;

    if (!action || !fileId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Action and fileId are required for favorites operations',
          requestError: {
            type: 'favorites',
            message: 'Missing required fields for favorites operation',
            operation: 'PUT /api/connections/favorites',
            details: {
              requiredFields: ['action', 'fileId'],
              providedFields: Object.keys(body)
            }
          } as FavoritesRequestError
        },
        { status: 400 }
      );
    }

    // Simulate favorites operation
    // In a real implementation, this would interact with the favorites service
    console.log(`Favorites operation: ${action} for file ${fileId} on ${provider}`);
    
    return NextResponse.json({
      success: true,
      data: {
        message: `Favorites operation ${action} completed successfully`,
        fileId,
        provider,
        accountKey
      }
    });
  } catch (error: any) {
    console.error('[connections] PUT favorites error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Favorites operation failed',
        requestError: {
          type: 'favorites',
          message: error.message || 'Unknown error occurred during favorites operation',
          operation: 'PUT /api/connections/favorites',
          details: {
            error: error.message,
            stack: error.stack
          }
        } as FavoritesRequestError
      },
      { status: 500 }
    );
  }
}

// OPTIONS handler for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
