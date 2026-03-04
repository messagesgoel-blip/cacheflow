/**
 * Gate: HOLD-UI
 * Task: UI-P1-T04@HOLD-UI-2026-03-02
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { transferRegistry } from '../../../../../lib/transfers/transferRegistry';

interface JwtPayload {
  id: string;
}

interface MoveRequest {
  fileId: string;
  newParentId: string;
  newName?: string; // Optional new name during move
  provider: string;
}

interface MoveResponse {
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
): Promise<NextResponse<MoveResponse>> {
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

    const moveReq: MoveRequest = await request.json();
    const { fileId, newParentId, newName, provider } = moveReq;

    if (!fileId || !newParentId) {
      return NextResponse.json(
        { success: false, error: 'File ID and new parent ID required' },
        { status: 400 }
      );
    }

    // Construct provider-specific move endpoint
    let moveUrl = '';
    let method = 'PATCH';
    let headers: Record<string, string> = {};
    let body: any;

    switch (provider.toLowerCase()) {
      case 'google':
        moveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
        // Google Drive moves by changing parents
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        body = JSON.stringify({
          addParents: newParentId,
          removeParents: 'root' // This removes from root - in practice would need to get current parents
        });
        method = 'PATCH';
        break;
        
      case 'onedrive':
        moveUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`;
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        body = JSON.stringify({
          parentReference: {
            id: newParentId
          },
          name: newName // Optional rename during move
        });
        method = 'PATCH';
        break;
        
      case 'dropbox':
        moveUrl = 'https://api.dropboxapi.com/2/files/move_v2';
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        // Get current path first, then construct move operation
        // This is simplified - in reality would need to fetch current path first
        return NextResponse.json(
          { success: false, error: 'Dropbox move requires current path - use provider API to get file metadata first' },
          { status: 400 }
        );
        
      case 'box':
        moveUrl = `https://api.box.com/2.0/files/${fileId}`;
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        body = JSON.stringify({
          parent: {
            id: newParentId
          }
        });
        method = 'PUT';
        break;
        
      case 'pcloud':
        moveUrl = `${process.env.PCLOUD_API_URL || 'https://api.pcloud.com'}//copyfile`;
        headers = {
          'Authorization': `Bearer ${accessToken}`,
        };
        // pCloud copy and delete for move operation
        return NextResponse.json(
          { success: false, error: 'pCloud move requires copy+delete operations' },
          { status: 400 }
        );
        
      case 'filen':
        moveUrl = `${process.env.FILEN_API_URL || 'https://api.filen.io'}/v3/file/move`;
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        body = JSON.stringify({
          uuid: fileId,
          new_parent_uuid: newParentId
        });
        break;
        
      case 'yandex':
        moveUrl = `https://cloud-api.yandex.net/v1/disk/resources/move`;
        headers = {
          'Authorization': `OAuth ${accessToken}`,
          'Content-Type': 'application/json',
        };
        // Requires from/to paths
        return NextResponse.json(
          { success: false, error: 'Yandex move requires full source and destination paths' },
          { status: 400 }
        );
        
      case 'webdav':
      case 'vps':
        return NextResponse.json(
          { success: false, error: 'WebDAV move operations handled differently' },
          { status: 400 }
        );
        
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
    }

    // First attempt with current token
    let response = await makeProviderRequest(moveUrl, method, headers, body);

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
        response = await makeProviderRequest(moveUrl, method, headers, body);

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
      operation: 'move',
      status: response.ok ? 'completed' : 'failed',
      error: response.ok ? undefined : `Move failed (${response.status})`,
      toastMessage: response.ok
        ? `Moved "${fileId}" successfully`
        : `Failed to move "${fileId}"`,
    });

    return NextResponse.json({
      success: response.ok,
      data: responseData,
    }, {
      status: response.ok ? 200 : response.status,
    });
  } catch (error) {
    console.error('Move action error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Move action failed',
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