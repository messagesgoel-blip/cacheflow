/**
 * Rate Limits API Endpoint
 * 
 * Monitor and manage rate-limited requests.
 * 
 * Gate: TRANSFER-1
 * Task: 3.15@TRANSFER-1
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getRateLimitQueueStats, getProviderRateLimitStats, clearProviderQueue, retryTransferJob } from '@/lib/transfer/rateLimitQueue';
import { withSecurityScan } from '@/lib/auth/securityAudit';

/**
 * GET /api/rate-limits
 * 
 * Get rate limit queue statistics.
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
    const provider = searchParams.get('provider');

    let stats;
    if (provider) {
      stats = await getProviderRateLimitStats(provider);
    } else {
      stats = await getRateLimitQueueStats();
    }

    const response = withSecurityScan({
      success: true,
      stats,
      provider: provider || 'all',
    }, '/api/rate-limits');

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get rate limits error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get rate limits' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/rate-limits
 * 
 * Manually retry a failed rate-limited job.
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

    const payload = await request.json().catch(() => ({}));
    const jobId = typeof payload?.jobId === 'string' ? payload.jobId : '';
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'jobId is required' },
        { status: 400 }
      );
    }

    const job = await retryTransferJob(jobId);

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found or not retryable' },
        { status: 404 }
      );
    }

    const response = withSecurityScan({
      success: true,
      jobId: job.id,
      status: 'queued',
    }, `/api/rate-limits/${jobId}/retry`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Retry rate limit error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to retry' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rate-limits?provider={provider}
 * 
 * Clear rate limit queue for a provider.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<any>> {
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
    const provider = searchParams.get('provider') || '';
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'provider is required' },
        { status: 400 }
      );
    }
    const removed = await clearProviderQueue(provider);

    const response = withSecurityScan({
      success: true,
      provider,
      removed,
    }, `/api/rate-limits/${provider}`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Clear rate limits error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to clear' 
      },
      { status: 500 }
    );
  }
}
