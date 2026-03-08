/**
 * Rate Limit Worker
 * 
 * Processes rate-limited requests with exponential backoff.
 * Automatically retries failed requests.
 * 
 * Gate: TRANSFER-1
 * Task: 3.15@TRANSFER-1
 */

import { Worker, Job } from 'bullmq';
import { rateLimitQueue, RateLimitJobData, RateLimitJobResult } from '../queues/rateLimitQueue';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const workerOptions = {
  connection,
  concurrency: 10, // Higher concurrency for rate limit retries
  limiter: {
    max: 20, // Max 20 retries per second
    duration: 1000,
  },
};

/**
 * Provider rate limit configurations
 */
const RATE_LIMITS: Record<string, {
  requestsPerSecond: number;
  requestsPerMinute: number;
  backoffMs: number;
}> = {
  google: { requestsPerSecond: 10, requestsPerMinute: 100, backoffMs: 1000 },
  dropbox: { requestsPerSecond: 5, requestsPerMinute: 50, backoffMs: 2000 },
  onedrive: { requestsPerSecond: 10, requestsPerMinute: 100, backoffMs: 1000 },
  box: { requestsPerSecond: 10, requestsPerMinute: 100, backoffMs: 1000 },
  default: { requestsPerSecond: 5, requestsPerMinute: 50, backoffMs: 2000 },
};

/**
 * Process a rate-limited request
 */
async function processRateLimit(job: Job<RateLimitJobData, RateLimitJobResult>): Promise<RateLimitJobResult> {
  const { provider, operation, requestUrl, requestBody, retryCount, maxRetries } = job.data;
  
  console.log(`[RateLimitWorker] Processing job ${job.id}: ${provider}/${operation} (attempt ${retryCount + 1}/${maxRetries})`);

  try {
    // Get provider rate limit config
    const config = RATE_LIMITS[provider] || RATE_LIMITS.default;

    // Wait for backoff period
    const backoffTime = config.backoffMs * Math.pow(2, retryCount);
    await new Promise(resolve => setTimeout(resolve, backoffTime));

    // Make the actual request
    // In production, this would use the actual provider SDK or API
    const response = await makeProviderRequest(provider, requestUrl, requestBody);

    console.log(`[RateLimitWorker] Completed job ${job.id}: ${provider}/${operation}`);

    return {
      success: true,
      response,
      retryable: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check if it's a rate limit error
    const isRateLimitError = errorMessage.includes('429') || 
                             errorMessage.includes('rate limit') ||
                             errorMessage.includes('too many requests');

    if (isRateLimitError && retryCount < maxRetries) {
      // Will be retried automatically by BullMQ with exponential backoff
      throw error;
    }

    // Not retryable or max retries exceeded
    console.error(`[RateLimitWorker] Failed job ${job.id}: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
      retryable: isRateLimitError && retryCount < maxRetries,
      nextRetryAt: isRateLimitError ? Date.now() + (60 * 1000) : undefined, // Retry after 1 minute
    };
  }
}

/**
 * Make actual provider request
 * In production, this would use the provider's SDK
 */
async function makeProviderRequest(provider: string, url: string, body?: any): Promise<any> {
  // Placeholder - in production would use actual provider API
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Provider ${provider} returned ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// Create the worker
export const rateLimitWorker = new Worker<RateLimitJobData, RateLimitJobResult>(
  rateLimitQueue.name,
  processRateLimit,
  workerOptions
);

// Event handlers
rateLimitWorker.on('completed', (job, result) => {
  console.log(`[RateLimitWorker] Job ${job?.id} completed: ${result?.success ? 'success' : 'failed'}`);
});

rateLimitWorker.on('failed', (job, error) => {
  console.error(`[RateLimitWorker] Job ${job?.id} failed after all retries: ${error.message}`);
});

rateLimitWorker.on('retries-exhausted', (job, error) => {
  console.error(`[RateLimitWorker] Job ${job?.id} retries exhausted: ${error.message}`);
  
  // Notify user via SSE/websocket
  // Could trigger email notification for critical failures
});

rateLimitWorker.on('error', (error) => {
  console.error(`[RateLimitWorker] Worker error: ${error.message}`);
});

/**
 * Gracefully shut down the worker
 */
export async function shutdownRateLimitWorker(): Promise<void> {
  await rateLimitWorker.close();
  await connection.quit();
  console.log('[RateLimitWorker] Worker shut down');
}

// Handle process signals
process.on('SIGTERM', shutdownRateLimitWorker);
process.on('SIGINT', shutdownRateLimitWorker);

export default rateLimitWorker;

