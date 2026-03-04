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

interface DownloadRequest {
  fileId: string;
  provider: string;
  exportFormat?: string; // For Google Docs/Sheets/Slides
}

interface DownloadResponse {
  success: boolean;
  data?: ArrayBuffer | string;
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
): Promise<NextResponse> {
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

    const downloadReq: DownloadRequest = await request.json();
    const { fileId, provider, exportFormat } = downloadReq;

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'File ID required' },
        { status: 400 }
      );
    }

    // Construct provider-specific download endpoint
    let downloadUrl = '';
    let headers: Record<string, string> = {};

    switch (provider.toLowerCase()) {
      case 'google':
        if (exportFormat) {
          // Export Google Docs/Sheets/Slides in specific format
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportFormat)}`;
        } else {
          // Download regular file
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        }
        headers = {
          'Authorization': `Bearer ${accessToken}`,
        };
        break;
        
      case 'onedrive':
        downloadUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`;
        headers = {
          'Authorization': `Bearer ${accessToken}`,
        };
        break;
        
      case 'dropbox':
        downloadUrl = 'https://content.dropboxapi.com/2/files/download';
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path: fileId }), // fileId is actually the path in Dropbox
        };
        break;
        
      case 'box':
        downloadUrl = `https://api.box.com/2.0/files/${fileId}/content`;
        headers = {
          'Authorization': `Bearer ${accessToken}`,
        };
        break;
        
      case 'pcloud':
        downloadUrl = `${process.env.PCLOUD_API_URL || 'https://api.pcloud.com'}/getfilelink?fileid=${fileId}`;
        headers = {
          'Authorization': `Bearer ${accessToken}`,
        };
        // Note: pCloud returns a download link that needs to be followed
        break;
        
      case 'filen':
        downloadUrl = `${process.env.FILEN_API_URL || 'https://api.filen.io'}/v3/file/download/info`;
        headers = {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        };
        // For Filen, need to get download info first, then download
        break;
        
      case 'yandex':
        downloadUrl = `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(fileId)}`;
        headers = {
          'Authorization': `OAuth ${accessToken}`,
        };
        break;
        
      case 'webdav':
      case 'vps':
        return NextResponse.json(
          { success: false, error: 'WebDAV download operations handled differently' },
          { status: 400 }
        );
        
      default:
        return NextResponse.json(
          { success: false, error: `Unsupported provider: ${provider}` },
          { status: 400 }
        );
    }

    // First attempt with current token
    let response = await makeProviderRequest(downloadUrl, 'GET', headers);

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
        response = await makeProviderRequest(downloadUrl, 'GET', headers);

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

    if (!response.ok) {
      let errorMessage = `Download failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.error?.message || errorBody.error || errorMessage;
      } catch {
        try {
          errorMessage = await response.text();
        } catch {}
      }

      transferRegistry.record(userId, {
        remoteUuid: uuid,
        provider,
        fileId,
        operation: 'download',
        status: 'failed',
        error: errorMessage,
        toastMessage: `Failed to download "${fileId}"`,
      });

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: response.status }
      );
    }

    if (provider.toLowerCase() === 'pcloud') {
      const linkData = await response.json();
      if (linkData.hosts && Array.isArray(linkData.hosts) && linkData.hosts.length > 0) {
        const downloadLink = `https://${linkData.hosts[0]}${linkData.path}`;
        const downloadResponse = await fetch(downloadLink);

        if (!downloadResponse.ok) {
          transferRegistry.record(userId, {
            remoteUuid: uuid,
            provider,
            fileId,
            operation: 'download',
            status: 'failed',
            error: `Failed to download file: ${downloadResponse.status}`,
            toastMessage: `Failed to download "${fileId}"`,
          });
          return NextResponse.json(
            { success: false, error: `Failed to download file: ${downloadResponse.status}` },
            { status: downloadResponse.status }
          );
        }

        const buffer = await downloadResponse.arrayBuffer();
        transferRegistry.record(userId, {
          remoteUuid: uuid,
          provider,
          fileId,
          operation: 'download',
          status: 'completed',
          toastMessage: `Downloaded "${fileId.split('/').pop() || fileId}" successfully`,
        });
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${fileId.split('/').pop() || 'download'}"`,
          },
        });
      } else {
        transferRegistry.record(userId, {
          remoteUuid: uuid,
          provider,
          fileId,
          operation: 'download',
          status: 'failed',
          error: 'Could not retrieve download link from pCloud',
          toastMessage: `Failed to download "${fileId}"`,
        });
        return NextResponse.json(
          { success: false, error: 'Could not retrieve download link from pCloud' },
          { status: 500 }
        );
      }
    }

    if (provider.toLowerCase() === 'filen') {
      const downloadInfo = await response.json();
      if (downloadInfo.url) {
        const downloadResponse = await fetch(downloadInfo.url);

        if (!downloadResponse.ok) {
          transferRegistry.record(userId, {
            remoteUuid: uuid,
            provider,
            fileId,
            operation: 'download',
            status: 'failed',
            error: `Failed to download file: ${downloadResponse.status}`,
            toastMessage: `Failed to download "${fileId}"`,
          });
          return NextResponse.json(
            { success: false, error: `Failed to download file: ${downloadResponse.status}` },
            { status: downloadResponse.status }
          );
        }

        const buffer = await downloadResponse.arrayBuffer();
        transferRegistry.record(userId, {
          remoteUuid: uuid,
          provider,
          fileId,
          fileName: downloadInfo.filename,
          operation: 'download',
          status: 'completed',
          toastMessage: `Downloaded "${downloadInfo.filename || fileId}" successfully`,
        });
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': downloadInfo.mimeType || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${downloadInfo.filename || 'download'}"`,
          },
        });
      } else {
        transferRegistry.record(userId, {
          remoteUuid: uuid,
          provider,
          fileId,
          operation: 'download',
          status: 'failed',
          error: 'Could not retrieve download info from Filen',
          toastMessage: `Failed to download "${fileId}"`,
        });
        return NextResponse.json(
          { success: false, error: 'Could not retrieve download info from Filen' },
          { status: 500 }
        );
      }
    }

    if (provider.toLowerCase() === 'yandex') {
      const downloadInfo = await response.json();
      if (downloadInfo.href) {
        const downloadResponse = await fetch(downloadInfo.href);

        if (!downloadResponse.ok) {
          transferRegistry.record(userId, {
            remoteUuid: uuid,
            provider,
            fileId,
            operation: 'download',
            status: 'failed',
            error: `Failed to download file: ${downloadResponse.status}`,
            toastMessage: `Failed to download "${fileId}"`,
          });
          return NextResponse.json(
            { success: false, error: `Failed to download file: ${downloadResponse.status}` },
            { status: downloadResponse.status }
          );
        }

        const buffer = await downloadResponse.arrayBuffer();
        transferRegistry.record(userId, {
          remoteUuid: uuid,
          provider,
          fileId,
          operation: 'download',
          status: 'completed',
          toastMessage: `Downloaded "${fileId.split('/').pop() || fileId}" successfully`,
        });
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${fileId.split('/').pop() || 'download'}"`,
          },
        });
      } else {
        transferRegistry.record(userId, {
          remoteUuid: uuid,
          provider,
          fileId,
          operation: 'download',
          status: 'failed',
          error: 'Could not retrieve download URL from Yandex',
          toastMessage: `Failed to download "${fileId}"`,
        });
        return NextResponse.json(
          { success: false, error: 'Could not retrieve download URL from Yandex' },
          { status: 500 }
        );
      }
    }

    const buffer = await response.arrayBuffer();

    let contentType = 'application/octet-stream';
    if (provider.toLowerCase() === 'google' && exportFormat) {
      if (exportFormat.includes('pdf')) contentType = 'application/pdf';
      else if (exportFormat.includes('html')) contentType = 'text/html';
      else if (exportFormat.includes('plain')) contentType = 'text/plain';
      else if (exportFormat.includes('msword')) contentType = 'application/msword';
      else if (exportFormat.includes('openxmlformats-officedocument')) contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    transferRegistry.record(userId, {
      remoteUuid: uuid,
      provider,
      fileId,
      operation: 'download',
      status: 'completed',
      toastMessage: `Downloaded "${fileId.split('/').pop() || fileId}" successfully`,
    });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileId.split('/').pop() || 'download'}"`,
      },
    });
  } catch (error) {
    console.error('Download action error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Download action failed',
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
  headers: Record<string, string> = {}
): Promise<Response> {
  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  return fetch(url, fetchOptions);
}