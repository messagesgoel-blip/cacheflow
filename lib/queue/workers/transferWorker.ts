/**
 * Transfer Worker — BullMQ worker that processes async transfer jobs.
 *
 * Pulls jobs from the `cacheflow:transfers` queue and executes them using
 * streamTransfer (zero-disk, stream-piped provider-to-provider transfer).
 * Progress updates are published to the Redis SSE bridge (progressBridge)
 * so connected SSE clients receive real-time updates.
 *
 * Concurrency: 5 simultaneous transfers.
 * Rate limit:  10 jobs / second (global, across all workers).
 *
 * Gate: TRANSFER-1, SSE-1
 * Task: 3.10@TRANSFER-1
 */

import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../../redis/client';
import { progressBridge } from '../../transfers/progressBridge';
import { streamTransfer } from '../../transfers/streamTransfer';
import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/ErrorCode';
import {
  TRANSFER_QUEUE_NAME,
  TransferJobData,
  TransferJobResult,
} from '../transferQueue';
import type { ProviderAdapter } from '../../providers/ProviderAdapter.interface';
import type { ProviderAuthState, ProviderOperationContext } from '../../providers/types';

// ---------------------------------------------------------------------------
// Provider adapter registry
// ---------------------------------------------------------------------------

/**
 * Resolves a provider ID string to its ProviderAdapter implementation.
 *
 * The adapters are loaded lazily to avoid circular import issues at module
 * load time.  In production, this map is extended with all supported
 * providers.  Tests can override the registry via `registerProviderAdapter`.
 */
const _adapterRegistry = new Map<string, ProviderAdapter>();

export function registerProviderAdapter(providerId: string, adapter: ProviderAdapter): void {
  _adapterRegistry.set(providerId, adapter);
}

function resolveAdapter(providerId: string): ProviderAdapter {
  const adapter = _adapterRegistry.get(providerId);
  if (!adapter) {
    throw new AppError({
      code: ErrorCode.PROVIDER_UNAVAILABLE,
      message: `TransferWorker: no adapter registered for provider "${providerId}"`,
    });
  }
  return adapter;
}

// ---------------------------------------------------------------------------
// Auth resolution
// ---------------------------------------------------------------------------

/**
 * Placeholder: resolve auth credentials for a user + provider pair.
 *
 * In a full implementation this reads the persisted OAuth tokens from the
 * database/vault and refreshes them if they are expired.  The interface is
 * intentionally minimal here — integration with the auth layer is task 3.11+.
 */
async function resolveAuth(
  _userId: string,
  _providerId: string,
): Promise<ProviderAuthState> {
  throw new AppError({
    code: ErrorCode.UNAUTHORIZED,
    message: 'TransferWorker: auth resolution not yet wired (task 3.11)',
    retryable: false,
  });
}

// ---------------------------------------------------------------------------
// Core processor
// ---------------------------------------------------------------------------

async function processTransfer(
  job: Job<TransferJobData, TransferJobResult>,
): Promise<TransferJobResult> {
  const {
    userId,
    sourceProvider,
    destProvider,
    fileId,
    fileName,
    fileSize,
    sourceFolderId,
    destFolderId,
    operation,
    throttle,
  } = job.data;

  const startMs = Date.now();

  console.log(
    `[TransferWorker] Starting job ${job.id}: ${operation} "${fileName}" ` +
    `(${fileSize} bytes) ${sourceProvider} → ${destProvider}`,
  );

  await job.updateProgress(0);

  // Publish worker log event (LOGS-1)
  await progressBridge.publishTransferLog(job.id!, userId, 'info', `Starting transfer: ${operation} "${fileName}" (${fileSize} bytes) ${sourceProvider} → ${destProvider}`);

  await progressBridge.publishTransferProgress(job.id!, userId, 0, {
    userId,
    sourceProvider,
    destProvider,
    fileId,
    fileName,
    fileSize,
    operation,
  });

  try {
    const [sourceAdapter, targetAdapter, sourceAuth, targetAuth] = await Promise.all([
      Promise.resolve(resolveAdapter(sourceProvider)),
      Promise.resolve(resolveAdapter(destProvider)),
      resolveAuth(userId, sourceProvider),
      resolveAuth(userId, destProvider),
    ]);

    const context: ProviderOperationContext = {
      requestId: job.id!,
      userId,
    };

    const result = await streamTransfer({
      context,
      sourceAdapter,
      sourceAuth,
      sourceFileId: fileId,
      targetAdapter,
      targetAuth,
      targetParentId: destFolderId,
      throttle,
      onProgress: async ({ percentage }) => {
        await job.updateProgress(percentage);
        await progressBridge.publishTransferProgress(job.id!, userId, percentage, {
          userId,
          sourceProvider,
          destProvider,
          fileId,
          fileName,
          fileSize,
          operation,
        });
      },
    });

    const duration = Date.now() - startMs;

    // Publish worker log event (LOGS-1)
    await progressBridge.publishTransferLog(job.id!, userId, 'info', `Transfer completed successfully in ${duration}ms`, {
      bytesTransferred: result.transferredBytes,
      duration,
    });

    await progressBridge.publishTransferComplete(job.id!, userId, {
      success: true,
      jobId: job.id!,
      fileName,
      fileSize: result.transferredBytes,
      duration,
    });

    console.log(
      `[TransferWorker] Completed job ${job.id} in ${duration}ms ` +
      `(${result.transferredBytes} bytes)`,
    );

    return {
      success: true,
      jobId: job.id!,
      fileName,
      fileSize: result.transferredBytes,
      duration,
    };
  } catch (err) {
    const duration = Date.now() - startMs;
    const appErr = AppError.fromUnknown(err, ErrorCode.TRANSFER_FAILED);
    const errorMessage = appErr.message;

    // Publish worker log event (LOGS-1)
    await progressBridge.publishTransferLog(job.id!, userId, 'error', `Transfer failed: ${errorMessage}`, {
      duration,
      retryable: appErr.retryable,
    });

    console.error(`[TransferWorker] Failed job ${job.id}: ${errorMessage}`);

    await progressBridge.publishTransferFailed(job.id!, userId, errorMessage);

    const retryable = appErr.retryable;

    return {
      success: false,
      jobId: job.id!,
      fileName,
      fileSize,
      duration,
      error: errorMessage,
      retryable,
    };
  }
}

// ---------------------------------------------------------------------------
// Worker instance
// ---------------------------------------------------------------------------

const _workerConnection = getRedisClient('workers');

export const transferWorker = new Worker<TransferJobData, TransferJobResult>(
  TRANSFER_QUEUE_NAME,
  processTransfer,
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: _workerConnection as any,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1_000,
    },
  },
);

// ---------------------------------------------------------------------------
// Worker event handlers
// ---------------------------------------------------------------------------

transferWorker.on('completed', (job: Job | undefined, result: any) => {
  console.log(
    `[TransferWorker] Job ${job?.id} → ${result?.success ? 'success' : 'fail'} ` +
    `"${result?.fileName}" (${result?.duration}ms)`,
  );
});

transferWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[TransferWorker] Job ${job?.id} failed: ${err.message}`);
});

transferWorker.on('progress', (job: Job | undefined, progress: any) => {
  console.log(`[TransferWorker] Job ${job?.id} progress: ${progress}%`);
});

transferWorker.on('error', (err: Error) => {
  console.error(`[TransferWorker] Worker-level error: ${err.message}`);
});

// ---------------------------------------------------------------------------
// Observability helpers
// ---------------------------------------------------------------------------

export async function getWorkerStats(): Promise<{
  isPaused: boolean;
  runningJobs: number;
}> {
  const isPaused = await transferWorker.isPaused();
  const runningJobs = (transferWorker as any).running?.size ?? 0;
  return { isPaused, runningJobs };
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

export async function shutdownWorker(): Promise<void> {
  await transferWorker.close();
  console.log('[TransferWorker] Worker shut down gracefully');
}

process.on('SIGTERM', shutdownWorker);
process.on('SIGINT', shutdownWorker);

export default transferWorker;
