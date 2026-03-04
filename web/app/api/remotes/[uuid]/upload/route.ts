/**
 * File Upload Endpoint
 * 
 * Handles file uploads to remote providers with progress tracking and toast notifications.
 * Uses the upload manager to coordinate with provider adapters.
 * 
 * Gate: UPLOAD-1
 * Task: 2.2@UPLOAD-1
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Readable } from 'stream';
import { withSecurityScan } from '../../../../../../web/lib/auth/securityAudit';
import { GoogleDriveAdapter } from '../../../../../../lib/providers/googleDrive';
import { OneDriveAdapter } from '../../../../../../lib/providers/onedrive';
import { DropboxAdapter } from '../../../../../../lib/providers/dropbox';
import { ProviderAdapter } from '../../../../../../lib/providers/ProviderAdapter.interface';
import { ProviderId } from '../../../../../../lib/providers/types';
import { uploadStream, createResumableUpload, uploadChunk, getUploadStatus, finalizeUpload } from '../../../../../../lib/uploads/uploadManager';
import { ProviderOperationContext, ProviderAuthState } from '../../../../../../lib/providers/types';
import { addTransferJob, getTransferJob } from '../../../../../../web/lib/transfer/jobQueue';

interface UploadRequest {
  parentId?: string;
  fileName: string;
  contentType?: string;
  contentLength?: number;
}

interface UploadResponse {
  success: boolean;
  fileId?: string;
  fileName?: string;
  size?: number;
  mimeType?: string;
  jobId?: string;
  sessionId?: string;
  error?: string;
}

interface ProgressUpdate {
  jobId: string;
  progress: number;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  message?: string;
}

/**
 * POST /api/remotes/[uuid]/upload
 * 
 * Upload a file to a remote provider.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
): Promise<NextResponse<UploadResponse>> {
  const { uuid } = await params;

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Decode user from token
    const { verify } = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
    let payload: any;
    try {
      payload = verify(accessToken, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get provider adapter by UUID
    const provider = getProviderById(uuid);
    if (!provider) {
      return NextResponse.json(
        { success: false, error: `Provider with ID ${uuid} not found` },
        { status: 404 }
      );
    }

    // Parse form data for file upload
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const parentId = formData.get('parentId') as string | null;
    const fileName = formData.get('fileName') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      );
    }

    const actualFileName = fileName || file.name;
    const contentLength = file.size;
    const contentType = file.type;

    // Create operation context
    const context: ProviderOperationContext = {
      requestId: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: payload.userId,
    };

    // For now, we'll need the auth state which should come from session or be looked up
    // In a real implementation, this would be retrieved from user's stored credentials
    const authState = await getAuthStateForProvider(uuid, payload.userId);
    
    if (!authState) {
      return NextResponse.json(
        { success: false, error: 'Provider authentication required' },
        { status: 401 }
      );
    }

    // Determine if we should use resumable upload based on file size
    const useResumable = contentLength > 10 * 1024 * 1024; // 10MB threshold

    if (useResumable) {
      // For large files, initiate resumable upload
      const chunkSize = 1024 * 1024; // 1MB chunks
      
      const sessionResult = await createResumableUpload({
        context,
        auth: authState,
        provider,
        parentId: parentId || undefined,
        originalFileName: actualFileName,
        contentType,
        contentLength,
        chunkSize,
      });

      // Create a transfer job to track progress
      const job = await addTransferJob({
        userId: payload.userId,
        sourceProvider: 'local', // Local file being uploaded
        destProvider: uuid,
        fileId: sessionResult.session.sessionId,
        fileName: actualFileName,
        fileSize: contentLength,
        sourceFolderId: undefined,
        destFolderId: parentId || undefined,
        operation: 'upload',
      });

      const response = withSecurityScan({
        success: true,
        sessionId: sessionResult.session.sessionId,
        jobId: job.id,
        fileName: actualFileName,
        size: contentLength,
        mimeType: contentType,
      }, `/api/remotes/${uuid}/upload`);

      return NextResponse.json(response, { status: 202 }); // Accepted for processing
    } else {
      // For small files, do direct upload
      const buffer = Buffer.from(await file.arrayBuffer());
      const stream = Readable.from(buffer);

      const result = await uploadStream({
        context,
        auth: authState,
        provider,
        parentId: parentId || undefined,
        originalFileName: actualFileName,
        contentType,
        contentLength,
        stream,
      });

      // Create a transfer job for tracking
      const job = await addTransferJob({
        userId: payload.userId,
        sourceProvider: 'local',
        destProvider: uuid,
        fileId: result.fileId,
        fileName: actualFileName,
        fileSize: contentLength,
        sourceFolderId: undefined,
        destFolderId: parentId || undefined,
        operation: 'upload',
      });

      // Security scan
      const response = withSecurityScan({
        success: true,
        fileId: result.fileId,
        fileName: result.fileName,
        size: result.size,
        mimeType: result.mimeType,
        jobId: job.id,
      }, `/api/remotes/${uuid}/upload`);

      return NextResponse.json(response, { status: 201 });
    }
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/remotes/[uuid]/upload
 * 
 * Get upload progress status (for resumable uploads).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
): Promise<NextResponse<any>> {
  const { uuid } = await params;

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Decode user from token
    const { verify } = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
    let payload: any;
    try {
      payload = verify(accessToken, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const sessionId = searchParams.get('sessionId');

    if (!jobId && !sessionId) {
      return NextResponse.json(
        { success: false, error: 'Job ID or Session ID is required' },
        { status: 400 }
      );
    }

    // Get provider adapter by UUID
    const provider = getProviderById(uuid);
    if (!provider) {
      return NextResponse.json(
        { success: false, error: `Provider with ID ${uuid} not found` },
        { status: 404 }
      );
    }

    if (jobId) {
      // Get transfer job status
      const job = await getTransferJob(jobId);
      
      if (!job) {
        return NextResponse.json(
          { success: false, error: 'Upload job not found' },
          { status: 404 }
        );
      }

      // Map job status to our progress status
      const statusMap: Record<string, ProgressUpdate['status']> = {
        'waiting': 'waiting',
        'active': 'active',
        'completed': 'completed',
        'failed': 'failed',
        'delayed': 'delayed',
      };

      const mappedStatus = job.failedReason 
        ? 'failed' 
        : job.finishedOn 
          ? 'completed' 
          : job.processedOn 
            ? 'active' 
            : 'waiting';

      const response = withSecurityScan({
        success: true,
        jobId: job.id,
        progress: job.progress || 0,
        status: mappedStatus,
        fileName: job.data.fileName,
        fileSize: job.data.fileSize,
        error: job.failedReason,
      }, `/api/remotes/${uuid}/upload`);

      return NextResponse.json(response);
    } else if (sessionId) {
      // For session-based status check - currently not fully implemented
      // Since getUploadSession returns null (placeholder), we return an error
      return NextResponse.json(
        { success: false, error: 'Upload session not found' },
        { status: 404 }
      );
    }

    // Should not reach here
    return NextResponse.json(
      { success: false, error: 'Invalid parameters' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Get upload status error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get upload status' 
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/remotes/[uuid]/upload
 * 
 * Upload a chunk for resumable upload.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
): Promise<NextResponse<any>> {
  const { uuid } = await params;

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Decode user from token
    const { verify } = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
    let payload: any;
    try {
      payload = verify(accessToken, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get provider adapter by UUID
    const provider = getProviderById(uuid);
    if (!provider) {
      return NextResponse.json(
        { success: false, error: `Provider with ID ${uuid} not found` },
        { status: 404 }
      );
    }

    // Parse form data for chunk upload
    const formData = await request.formData();
    const chunkFile = formData.get('chunk') as File | null;
    const sessionId = formData.get('sessionId') as string | null;
    const offset = parseInt(formData.get('offset') as string || '0');
    const isFinalChunk = formData.get('isFinalChunk') === 'true';

    if (!chunkFile || !sessionId) {
      return NextResponse.json(
        { success: false, error: 'Chunk file and session ID are required' },
        { status: 400 }
      );
    }

    // Get auth state and session
    const authState = await getAuthStateForProvider(uuid, payload.userId);
    const session = await getUploadSession(sessionId);
    
    if (!authState || !session) {
      return NextResponse.json(
        { success: false, error: 'Upload session not found' },
        { status: 404 }
      );
    }

    // Convert chunk to buffer
    const chunkBuffer = Buffer.from(await chunkFile.arrayBuffer());

    // Since getUploadSession is a placeholder that returns null, we can't actually upload chunks yet
    // This would be implemented in a real system with proper session storage
    return NextResponse.json(
      { success: false, error: 'Chunked upload not fully implemented - session storage required' },
      { status: 501 }
    );
  } catch (error) {
    console.error('Chunk upload error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Chunk upload failed' 
      },
      { status: 500 }
    );
  }
}

/**
 * Get provider adapter by ID
 * This creates a new instance of the appropriate provider adapter
 */
function getProviderById(id: string): ProviderAdapter | null {
  switch (id) {
    case 'google':
      return new GoogleDriveAdapter();
    case 'onedrive':
      return new OneDriveAdapter();
    case 'dropbox':
      return new DropboxAdapter();
    default:
      // Could add more providers here as needed
      console.warn(`Provider ${id} not implemented`);
      return null;
  }
}

/**
 * Helper function to get auth state for provider
 * This would typically retrieve stored credentials for the user and provider
 */
async function getAuthStateForProvider(providerId: string, userId: string): Promise<ProviderAuthState | null> {
  // This is a placeholder implementation
  // In a real system, this would retrieve stored auth from database
  console.warn(`Need to implement auth retrieval for provider ${providerId} and user ${userId}`);
  return null; // Placeholder - would return actual auth state
}

/**
 * Helper function to get upload session
 * This would typically retrieve session from database/cache
 */
async function getUploadSession(sessionId: string) {
  // This is a placeholder implementation
  // In a real system, this would retrieve session from database
  console.warn(`Need to implement session retrieval for session ${sessionId}`);
  return null; // Placeholder - would return actual session
}