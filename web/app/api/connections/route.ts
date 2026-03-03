/**
 * Connections API Route
 *
 * Provides unified server-state connections data to frontend components.
 * Reads from backend remotes API to get provider connections.
 *
 * Gate: SYNC-1
 * Task: 1.16@SYNC-1
 */

import { NextRequest, NextResponse } from 'next/server';

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
  remoteId: string;
  accountName: string;
  accountEmail: string;
  accountLabel: string;
  isDefault: boolean;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt?: string;
}

const DEFAULT_API_BASE = 'http://cacheflow-api:8100';

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
    provider: remote.provider,
    accountKey,
    remoteId: remote.id,
    accountName: accountLabel,
    accountEmail,
    accountLabel,
    isDefault: false,
    status,
    lastSyncAt: remote.updated_at,
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
    const authHeader = request.headers.get('authorization');
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
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { success: false, error: 'Failed to fetch connections from server' },
        { status: backendResponse.status }
      );
    }

    const payload = await backendResponse.json();
    const remotes = extractRemotes(payload);
    const connections = remotes.map(mapRemoteToConnection);

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
