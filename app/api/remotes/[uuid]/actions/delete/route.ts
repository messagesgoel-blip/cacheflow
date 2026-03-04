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

interface DeleteRequest {
  fileId: string;
  provider: string;
}

interface DeleteResponse {
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
): Promise<NextResponse<DeleteResponse>> {
  const { uuid } = await params;

  try {
    const cookieStore = await cookies();
    let accessToken = cookieStore.get('accessToken')?.value;

    let userId = 'anonymous';
    if (accessToken) {
      try {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET!) as JwtPayload;
        userId = decoded.id;
      } catch {
        }
    }

    const deleteReq: DeleteRequest = await request.json();
    const { fileId, provider } = deleteReq;

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'File ID required' },
        { status: 400 }
      );
    }

    // Construct provider-specific delete endpoint
    let deleteUrl = '';
    let method = 'DELETE';
    let headers: Record<string, string> = {};

    switch (provider.toLowerCase()) {
      case 'google':
        deleteUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
        headers = {
          'Authorization': `Bearer ${accessToken}`,
        };
        method = 'DELETE';
        break;
        
      case 'onedrive':
        deleteUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`;
        headers = {
          'Authorization': `Bearer ${accessToken}`,
        };
        method = 'DELETE';
        break;
        
      case 'dropbox':
        deleteUrl = 'https://api.dropboxapi.com/2/files/delete_v2';
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        // Dropbox requires the path to delete
        return NextResponse.json(
          { success: false, error: 'Dropbox delete requires full file path' },
          { status: 400 }
        );
        
      case 'box':
        deleteUrl = `https://api.box.com/2.0/files/${fileId}`;
        headers = {
          'Authorization': `Bearer ${accessToken}`,
        };
        method = 'DELETE';
        break;
        
      case 'pcloud':
        deleteUrl = `${process.env.PCLOUD_API_URL || 'https://api.pcloud.com'}/deletefile`;
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'filename': fileId, // pCloud identifies files by filename in URL params
        };
        // Actually needs to be sent as query param, not header
        return NextResponse.json(
          { success: false, error: 'pCloud delete requires file ID as query parameter' },
          { status: 400 }
        );
        
      case 'filen':
        deleteUrl = `${process.env.FILEN_API_URL || 'https://api.filen.io'}/v3/file/delete`;
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        method = 'POST'; // Filen uses POST for delete
        break;
        
      case 'yandex':
        deleteUrl = `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(fileId)}`;
        headers = {
          'Authorization': `OAuth ${accessToken}`,
        };
        method = 'DELETE';
        break;
        
      case 'webdav':
      case 'vps':
        return NextResponse.json(
          { success: false, error: 'WebDAV delete operations handled differently' },
          { status: 400 }
        );
        
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
    }

    // Prepare body for providers that require it
    let body: any;
    if (provider.toLowerCase() === 'dropbox') {
      // Dropbox delete requires the path in the body
      body = JSON.stringify({ path: fileId });
    } else if (provider.toLowerCase() === 'filen') {
      // Filen delete requires the UUID in the body
      body = JSON.stringify({ uuid: fileId });
    }

    // First attempt with current token
    let response = await makeProviderRequest(deleteUrl, method, headers, body);

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
        response = await makeProviderRequest(deleteUrl, method, headers, body);

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
      if (response.status !== 204) {
        responseData = await response.json();
      } else {
        responseData = { success: true };
      }
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
      operation: 'delete',
      status: response.ok ? 'completed' : 'failed',
      error: response.ok ? undefined : `Delete failed (${response.status})`,
      toastMessage: response.ok
        ? `Deleted "${fileId}" successfully`
        : `Failed to delete "${fileId}"`,
    });

    return NextResponse.json({
      success: response.ok,
      data: responseData,
    }, {
      status: response.ok ? 200 : response.status,
    });
  } catch (error) {
    console.error('Delete action error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Delete action failed',
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