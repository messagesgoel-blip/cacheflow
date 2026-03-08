/**
 * Rate Limit Queue
 * 
 * BullMQ queue for handling provider rate limits.
 * Automatically retries failed requests with exponential backoff.
 * 
 * Gate: TRANSFER-1
 * Task: 3.15@TRANSFER-1
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

export interface RateLimitJobData {
  provider: string;
  operation: string;
  requestUrl: string;
  requestBody?: any;
  userId: string;
  retryCount: number;
  maxRetries: number;
  backoffMs: number;
  originalError?: string;
}

export interface RateLimitJobResult {
  success: boolean;
  response?: any;
  error?: string;
  retryable: boolean;
  nextRetryAt?: number;
}

// Queue configuration
const RATE_LIMIT_QUEUE_NAME = 'cacheflow:rate-limits';

const queueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2s, then 4s, 8s, 16s, 32s
    },
    removeOnComplete: {
      age: 3600,
      count: 500,
    },
    removeOnFail: {
      age: 24 * 3600,
    },
  },
};

// Create the rate limit queue
export const rateLimitQueue = new Queue<RateLimitJobData, RateLimitJobResult>(
  RATE_LIMIT_QUEUE_NAME,
  queueOptions
);

/**
 * Add a rate-limited request to the queue
 */
export async function addRateLimitJob(data: Omit<RateLimitJobData, 'retryCount' | 'maxRetries' | 'backoffMs'>): Promise<Job> {
  const jobId = `rate-limit-${data.provider}-${data.userId}-${Date.now()}`;
  
  const job = await rateLimitQueue.add(jobId, {
    ...data,
    retryCount: 0,
    maxRetries: 5,
    backoffMs: 2000,
  }, {
    jobId,
    priority: 5,
  });

  console.log(`[RateLimitQueue] Added job ${job.id} for ${data.provider}/${data.operation}`);
  
  return job;
}

/**
 * Handle rate limit response - add to retry queue
 */
export async function handleRateLimit(
  provider: string,
  operation: string,
  requestUrl: string,
  requestBody: any,
  userId: string,
  retryAfterSeconds?: number
): Promise<Job> {
  const backoffMs = retryAfterSeconds 
    ? retryAfterSeconds * 1000 
    : 2000; // Default 2s backoff

  return addRateLimitJob({
    provider,
    operation,
    requestUrl,
    requestBody,
    userId,
    originalError: `Rate limited by ${provider}`,
  });
}

/**
 * Get queue statistics
 */
export async function getRateLimitQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    rateLimitQueue.getWaitingCount(),
    rateLimitQueue.getActiveCount(),
    rateLimitQueue.getCompletedCount(),
    rateLimitQueue.getFailedCount(),
    rateLimitQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Get provider-specific rate limit stats
 */
export async function getProviderRateLimitStats(provider: string): Promise<{
  waiting: number;
  delayed: number;
  failed: number;
}> {
  const jobs = await rateLimitQueue.getJobs(['waiting', 'delayed', 'failed'], 0, 1000);
  const providerJobs = jobs.filter(job => job.data.provider === provider);

  return {
    waiting: providerJobs.filter(j => j.waiting).length,
    delayed: providerJobs.filter(j => j.delayed).length,
    failed: providerJobs.filter(j => j.failed).length,
  };
}

/**
 * Clear rate limit queue for a provider
 */
export async function clearProviderQueue(provider: string): Promise<number> {
  const jobs = await rateLimitQueue.getJobs(['waiting', 'delayed'], 0, 1000);
  const providerJobs = jobs.filter(job => job.data.provider === provider);
  
  let removed = 0;
  for (const job of providerJobs) {
    await job.remove();
    removed++;
  }

  console.log(`[RateLimitQueue] Removed ${removed} jobs for provider ${provider}`);
  return removed;
}

export { Job };

