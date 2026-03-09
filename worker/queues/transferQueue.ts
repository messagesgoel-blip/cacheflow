/**
 * Transfer Queue
 * 
 * BullMQ queue for async file transfers.
 * Handles large file transfers in background to avoid blocking UI.
 * 
 * Gate: TRANSFER-1
 * Task: 3.10@TRANSFER-1
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    if (times > 3) {
      return null; // Stop retrying
    }
    return Math.min(times * 200, 2000);
  },
});

export interface TransferJobData {
  userId: string;
  sourceProvider: string;
  destProvider: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  sourceFolderId?: string;
  destFolderId?: string;
  operation: 'copy' | 'move' | 'upload' | 'download';
  chunkSize?: number;
  totalChunks?: number;
  currentChunk?: number;
  uploadUrl?: string;
}

export interface TransferJobResult {
  success: boolean;
  jobId: string;
  fileName: string;
  fileSize: number;
  duration: number;
  error?: string;
  retryable?: boolean;
}

// Queue configuration
const TRANSFER_QUEUE_NAME = 'cacheflow:transfers';

const queueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep up to 1000 completed jobs
    },
    removeOnFail: {
      age: 24 * 3600, // Keep failed jobs for 24 hours
    },
  },
};

// Create the transfer queue
export const transferQueue = new Queue<TransferJobData, TransferJobResult>(
  TRANSFER_QUEUE_NAME,
  queueOptions
);

/**
 * Add a transfer job to the queue
 */
export async function addTransferJob(data: TransferJobData): Promise<Job<TransferJobData, TransferJobResult>> {
  const jobId = `transfer-${data.userId}-${Date.now()}`;
  
  const job = await transferQueue.add(jobId, data, {
    jobId,
    priority: data.fileSize >= 50 * 1024 * 1024 ? 5 : 10, // Lower numbers run first in BullMQ
  });

  console.log(`[TransferQueue] Added job ${job.id} for ${data.fileName} (${data.fileSize} bytes)`);
  
  return job;
}

/**
 * Get queue statistics
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
 * Get job by ID
 */
export async function getTransferJob(jobId: string): Promise<Job<TransferJobData, TransferJobResult> | undefined> {
  return transferQueue.getJob(jobId);
}

/**
 * Get user's transfer jobs
 */
export async function getUserTransferJobs(userId: string, limit = 50): Promise<Job[]> {
  const jobs = await transferQueue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, limit);
  return jobs.filter(job => job.data.userId === userId);
}

/**
 * Cancel a transfer job
 */
export async function cancelTransferJob(jobId: string): Promise<void> {
  const job = await transferQueue.getJob(jobId);
  if (job) {
    await job.remove();
    console.log(`[TransferQueue] Cancelled job ${jobId}`);
  }
}

/**
 * Retry a failed job
 */
export async function retryTransferJob(jobId: string): Promise<Job | null> {
  const job = await transferQueue.getJob(jobId);
  if (job && job.failedReason) {
    return job.retry();
  }
  return null;
}

/**
 * Pause the queue
 */
export async function pauseQueue(): Promise<void> {
  await transferQueue.pause();
  console.log('[TransferQueue] Queue paused');
}

/**
 * Resume the queue
 */
export async function resumeQueue(): Promise<void> {
  await transferQueue.resume();
  console.log('[TransferQueue] Queue resumed');
}

/**
 * Clean old jobs
 */
export async function cleanQueue(): Promise<number> {
  const removed = await transferQueue.clean(
    3600000, // 1 hour ago
    1000, // Limit to 1000 jobs
    'completed'
  );
  console.log(`[TransferQueue] Cleaned ${removed.length} completed jobs`);
  return removed.length;
}

// Export types
export type { Job };
