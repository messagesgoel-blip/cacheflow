/**
 * Transfer Queue — BullMQ queue for async file transfers.
 *
 * Canonical shared-library entry point for enqueueing, inspecting, and
 * managing background transfer jobs.  Used by:
 *   - Next.js API routes  (web/app/api/transfers/route.ts)
 *   - The transfer worker (lib/queue/workers/transferWorker.ts)
 *
 * Redis namespace: `workers` (db=4) for BullMQ job state.
 * Progress pub/sub uses `sse` (db=1) via progressBridge.
 *
 * Gate: TRANSFER-1, SSE-1
 * Task: 3.10@TRANSFER-1
 */

import { Queue, Job } from 'bullmq';
import { getRedisClient } from '../redis/client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** BullMQ queue name — stable across restarts and deployments. */
export const TRANSFER_QUEUE_NAME = 'cacheflow:transfers';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Data payload attached to every transfer job. */
export interface TransferJobData {
  /** Owning user's ID — used for progress routing and access-control. */
  userId: string;
  /** Provider identifier for the source file (e.g. "google", "dropbox"). */
  sourceProvider: string;
  /** Provider identifier for the destination (e.g. "onedrive", "dropbox"). */
  destProvider: string;
  /** File identifier on the source provider. */
  fileId: string;
  /** Display name of the file being transferred. */
  fileName: string;
  /** File size in bytes. */
  fileSize: number;
  /** Source folder ID (undefined = source root). */
  sourceFolderId?: string;
  /** Destination folder ID (undefined = destination root). */
  destFolderId?: string;
  /** Semantic operation type. */
  operation: 'copy' | 'move' | 'upload' | 'download';
}

/** Result payload returned by a completed transfer job. */
export interface TransferJobResult {
  success: boolean;
  jobId: string;
  fileName: string;
  fileSize: number;
  /** Wall-clock duration of the transfer in milliseconds. */
  duration: number;
  error?: string;
  /** Whether the failure is safe to retry. */
  retryable?: boolean;
}

// ---------------------------------------------------------------------------
// Redis connection
// ---------------------------------------------------------------------------

/**
 * BullMQ requires `maxRetriesPerRequest: null` on its ioredis connection.
 * We derive a dedicated connection from the canonical `workers` namespace.
 */
function createBullConnection() {
  const base = getRedisClient('workers');
  // ioredis instances are re-usable; BullMQ duplicates internally when needed.
  // Cast: ioredis types are compatible — BullMQ accepts the ioredis instance.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return base as any;
}

// ---------------------------------------------------------------------------
// Queue instance
// ---------------------------------------------------------------------------

const _queueConnection = createBullConnection();

/**
 * Singleton BullMQ Queue for all transfer jobs.
 *
 * Completed jobs are retained for 1 hour (up to 1 000 entries).
 * Failed jobs are retained for 24 hours for debugging.
 * Every job gets 3 attempts with exponential back-off starting at 1 s.
 */
export const transferQueue = new Queue<TransferJobData, TransferJobResult>(
  TRANSFER_QUEUE_NAME,
  {
    connection: _queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1_000,
      },
      removeOnComplete: {
        age: 3_600,      // 1 hour in seconds
        count: 1_000,    // max retained completed entries
      },
      removeOnFail: {
        age: 24 * 3_600, // 24 hours in seconds
      },
    },
  },
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enqueue a new file transfer job.
 *
 * The job ID is deterministic: `transfer-{userId}-{unixMs}`.  Large files
 * (≥ 50 MiB) receive a higher numeric priority so the worker can favour
 * them when the queue is busy (lower BullMQ priority number = higher
 * urgency; we use 5 for large files, 10 for small).
 */
export async function addTransferJob(
  data: TransferJobData,
): Promise<Job<TransferJobData, TransferJobResult>> {
  const jobId = `transfer-${data.userId}-${Date.now()}`;

  // BullMQ priority: lower number = higher urgency.
  // Large files get priority 5; everything else gets 10.
  const priority = data.fileSize >= 50 * 1_024 * 1_024 ? 5 : 10;

  const job = await transferQueue.add(jobId, data, { jobId, priority });

  console.log(
    `[TransferQueue] Enqueued job ${job.id}: ${data.operation} "${data.fileName}" ` +
    `(${data.fileSize} bytes) ${data.sourceProvider} → ${data.destProvider}`,
  );

  return job;
}

/**
 * Retrieve a single job by its BullMQ job ID.
 * Returns `undefined` when the job has been removed (completed TTL expired).
 */
export async function getTransferJob(
  jobId: string,
): Promise<Job<TransferJobData, TransferJobResult> | undefined> {
  return transferQueue.getJob(jobId);
}

/**
 * List transfer jobs owned by a specific user.
 *
 * Scans all non-terminal and terminal states up to `limit` entries.
 * Results are returned newest-first (BullMQ returns jobs in insertion order;
 * we reverse for convenience).
 */
export async function getUserTransferJobs(
  userId: string,
  limit = 50,
): Promise<Job<TransferJobData, TransferJobResult>[]> {
  const jobs = await transferQueue.getJobs(
    ['waiting', 'active', 'completed', 'failed', 'delayed'],
    0,
    limit,
  );
  return jobs
    .filter((job) => job.data.userId === userId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Snapshot of queue depths across all states.
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    transferQueue.getWaitingCount(),
    transferQueue.getActiveCount(),
    transferQueue.getCompletedCount(),
    transferQueue.getFailedCount(),
    transferQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Remove a job from the queue.  Silently succeeds when the job no longer
 * exists (already completed/removed by TTL).
 */
export async function cancelTransferJob(jobId: string): Promise<void> {
  const job = await transferQueue.getJob(jobId);
  if (job) {
    await job.remove();
    console.log(`[TransferQueue] Cancelled job ${jobId}`);
  }
}

/**
 * Re-queue a failed job for another processing attempt.
 * Returns `null` when the job is not found or is not in a failed state.
 */
export async function retryTransferJob(
  jobId: string,
): Promise<Job<TransferJobData, TransferJobResult> | null> {
  const job = await transferQueue.getJob(jobId);
  if (job && job.failedReason) {
    await job.retry();
    return job;
  }
  return null;
}

/**
 * Pause the queue — new jobs will accumulate but no worker will pick them up.
 * Useful during maintenance or rate-limit back-off periods.
 */
export async function pauseQueue(): Promise<void> {
  await transferQueue.pause();
  console.log('[TransferQueue] Queue paused');
}

/**
 * Resume a previously paused queue.
 */
export async function resumeQueue(): Promise<void> {
  await transferQueue.resume();
  console.log('[TransferQueue] Queue resumed');
}

/**
 * Remove completed jobs older than `ageMs` milliseconds (default: 1 hour).
 * Returns the count of removed jobs.
 */
export async function cleanQueue(ageMs = 3_600_000): Promise<number> {
  const removed = await transferQueue.clean(ageMs, 1_000, 'completed');
  console.log(`[TransferQueue] Cleaned ${removed.length} completed jobs`);
  return removed.length;
}

// Re-export BullMQ Job type for callers.
export type { Job };
