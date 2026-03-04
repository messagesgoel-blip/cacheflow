/**
 * Gate: HOLD-UI
 * Task: UI-P1-T04@HOLD-UI-2026-03-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { withSecurityScan } from '../../../../../lib/auth/securityAudit';
import { transferRegistry } from '../../../../../lib/transfers/transferRegistry';

interface JwtPayload {
  id: string;
}

interface RenameRequest {
  fileId: string;
  newName: string;
  provider: string;
}

interface RenameResponse {
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
): Promise<NextResponse<RenameResponse>> {
  const { uuid } = await params;

  try {
    const cookieStore = await cookies();
    let accessToken = cookieStore.get('accessToken')?.value;

    let userId = 'anonymous';
    if (accessToken) {
      try {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET!) as JwtPayload;
        userId = decoded.id;
      } catch {}
    }

    const renameReq: RenameRequest = await request.json();
    const { fileId, newName, provider } = renameReq;

    if (!fileId || !newName) {
      return NextResponse.json(
        { success: false, error: 'File ID and new name required' },
        { status: 400 }
      );
    }

    // Construct provider-specific rename endpoint
    let renameUrl = '';
    switch (provider.toLowerCase()) {
      case 'google':
        renameUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
        break;
      case 'onedrive':
        renameUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`;
        break;
      case 'dropbox':
        renameUrl = 'https://api.dropboxapi.com/2/files/move_v2';
        break;
      case 'box':
        renameUrl = `https://api.box.com/2.0/files/${fileId}`;
        break;
      case 'pcloud':
        // pCloud rename typically requires the destination folder + new name
        return NextResponse.json(
          { success: false, error: 'pCloud rename requires special handling - use move operation instead' },
          { status: 400 }
        );
      case 'filen':
        renameUrl = `${process.env.FILEN_API_URL || 'https://api.filen.io'}/v3/file/rename`;
        break;
      case 'yandex':
        renameUrl = `https://cloud-api.yandex.net/v1/disk/resources`;
        break;
      case 'webdav':
      case 'vps':
        // WebDAV operations handled differently, typically through move/copy
        return NextResponse.json(
          { success: false, error: 'WebDAV rename handled through move operation' },
          { status: 400 }
        );
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
    }

    // Prepare the request based on provider
    let method = 'PATCH';
    let headers: Record<string, string> = {};
    let body: any;

    switch (provider.toLowerCase()) {
      case 'google':
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        body = JSON.stringify({ name: newName });
        break;
        
      case 'onedrive':
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        body = JSON.stringify({ name: newName });
        break;
        
      case 'dropbox':
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        // For Dropbox, we need to use move to rename (keeping same parent folder)
        // First, we'd need to get the parent folder, then move to same parent with new name
        // This is simplified - in practice would need to fetch parent path first
        return NextResponse.json(
          { success: false, error: 'Dropbox rename requires fetching current path first' },
          { status: 400 }
        );
        
      case 'box':
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        body = JSON.stringify({ name: newName });
        break;
        
      case 'filen':
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        body = JSON.stringify({ 
          uuid: fileId,
          name: newName 
        });
        break;
        
      case 'yandex':
        headers = {
          'Authorization': `OAuth ${accessToken}`,
          'Content-Type': 'application/json',
        };
        // Yandex requires the path to the resource
        return NextResponse.json(
          { success: false, error: 'Yandex rename requires full path - not just file ID' },
          { status: 400 }
        );
    }

    // First attempt with current token
    let response = await makeProviderRequest(renameUrl, method, headers, body);

    // Handle 401 - single refresh+retry
    if (response.status === 401) {
      try {
        // Refresh token once
        accessToken = await refreshAuthToken();
        
        // Update auth header with new token
        if (provider.toLowerCase() === 'yandex') {
          headers['Authorization'] = `OAuth ${accessToken}`;
        } else {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }
        
        // Retry with new token
        response = await makeProviderRequest(renameUrl, method, headers, body);

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

    let responseData;
    try {
      responseData = await response.json();
    } catch {
      try {
        responseData = await response.text();
      } catch {
        responseData = { success: response.ok };
      }
    }

    transferRegistry.record(userId, {
      remoteUuid: uuid,
      provider,
      fileId,
      operation: 'rename',
      status: response.ok ? 'completed' : 'failed',
      error: response.ok ? undefined : `Rename failed (${response.status})`,
      toastMessage: response.ok
        ? `Renamed "${fileId}" to "${newName}"`
        : `Failed to rename "${fileId}"`,
    });

    const safeResponse = withSecurityScan({
      success: response.ok,
      data: responseData,
    }, `/api/remotes/${uuid}/actions/rename`);

    return NextResponse.json(safeResponse, {
      status: response.ok ? 200 : response.status,
    });
  } catch (error) {
    console.error('Rename action error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Rename action failed',
      },
      { status: 500 }
    );
  }
}

/**
 * Make the actual request to provider API
 */
async function makeProviderRequest(
  url: string,
  method: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<Response> {
  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    fetchOptions.body = body;
  }

  return fetch(url, fetchOptions);
}