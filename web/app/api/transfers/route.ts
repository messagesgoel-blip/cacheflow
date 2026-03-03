/**
 * Transfers API Endpoint
 * 
 * Create and monitor async transfer jobs.
 * 
 * Gate: TRANSFER-1
 * Task: 3.10@TRANSFER-1
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { addTransferJob, getTransferJob, getUserTransferJobs, getQueueStats, cancelTransferJob } from '@/lib/transfer/jobQueue';
import { withSecurityScan } from '@/lib/auth/securityAudit';

export interface CreateTransferRequest {
  sourceProvider: string;
  destProvider: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  sourceFolderId?: string;
  destFolderId?: string;
  operation: 'copy' | 'move' | 'upload' | 'download';
}

export interface TransferStatus {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  fileName: string;
  fileSize: number;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

/**
 * POST /api/transfers
 * 
 * Create a new async transfer job.
 */
export async function POST(request: NextRequest): Promise<NextResponse<any>> {
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

    const body: CreateTransferRequest = await request.json();
    const { sourceProvider, destProvider, fileId, fileName, fileSize, sourceFolderId, destFolderId, operation } = body;

    // Validate required fields
    if (!sourceProvider || !destProvider || !fileId || !fileName || !fileSize) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create transfer job
    const job = await addTransferJob({
      userId: payload.userId,
      sourceProvider,
      destProvider,
      fileId,
      fileName,
      fileSize,
      sourceFolderId,
      destFolderId,
      operation,
    });

    const response = withSecurityScan({
      success: true,
      jobId: job.id,
      status: 'queued',
    }, '/api/transfers');

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Create transfer error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create transfer' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transfers
 * 
 * Get user's transfer jobs.
 */
export async function GET(request: NextRequest): Promise<NextResponse<any>> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;
    
    if (!accessToken) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

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

    const jobs = await getUserTransferJobs(payload.userId, limit);
    
    const transfers: TransferStatus[] = jobs.map(job => ({
      jobId: job.id,
      status: job.failedReason ? 'failed' : (job.finishedOn ? 'completed' : (job.processedOn ? 'active' : 'waiting')),
      progress: job.progress || 0,
      fileName: job.data.fileName,
      fileSize: job.data.fileSize,
      createdAt: job.timestamp,
      completedAt: job.finishedOn,
      error: job.failedReason,
    }));

    const response = withSecurityScan({
      success: true,
      transfers,
    }, '/api/transfers');

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get transfers error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get transfers' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/transfers/stats
 * 
 * Get queue statistics.
 */
export async function GET_STATS(request: NextRequest): Promise<NextResponse<any>> {
  try {
    const stats = await getQueueStats();
    
    const response = withSecurityScan({
      success: true,
      stats,
    }, '/api/transfers/stats');

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get stats' 
      },
      { status: 500 }
    );
  }
}
