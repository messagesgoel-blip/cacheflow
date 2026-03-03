/**
 * Transfer Worker
 * 
 * BullMQ worker that processes async transfer jobs.
 * Handles file operations in background with progress tracking.
 * 
 * Gate: TRANSFER-1
 * Task: 3.10@TRANSFER-1
 */

import { Worker, Job } from 'bullmq';
import { transferQueue, TransferJobData, TransferJobResult } from '../queues/transferQueue';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const workerOptions = {
  connection,
  concurrency: 5, // Process 5 transfers concurrently
  limiter: {
    max: 10, // Max 10 jobs per
    duration: 1000, // second (rate limiting)
  },
};

/**
 * Process a transfer job
 */
async function processTransfer(job: Job<TransferJobData, TransferJobResult>): Promise<TransferJobResult> {
  const { userId, sourceProvider, destProvider, fileId, fileName, fileSize, operation } = job.data;
  
  const startTime = Date.now();
  
  console.log(`[TransferWorker] Processing job ${job.id}: ${operation} ${fileName} (${fileSize} bytes)`);
  
  try {
    // Update progress
    await job.updateProgress(10);
    
    // In production, this would:
    // 1. Fetch file from source provider
    // 2. Stream to destination provider
    // 3. Handle chunking for large files
    // 4. Report progress via SSE/websocket
    
    // Simulate transfer progress
    for (let i = 10; i <= 90; i += 20) {
      await job.updateProgress(i);
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate work
    }
    
    // Simulate completion
    await new Promise(resolve => setTimeout(resolve, 200));
    await job.updateProgress(100);
    
    const duration = Date.now() - startTime;
    
    console.log(`[TransferWorker] Completed job ${job.id} in ${duration}ms`);
    
    return {
      success: true,
      jobId: job.id,
      fileName,
      fileSize,
      duration,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const duration = Date.now() - startTime;
    
    console.error(`[TransferWorker] Failed job ${job.id}: ${errorMessage}`);
    
    // Determine if retryable
    const retryable = !errorMessage.includes('permission') && 
                      !errorMessage.includes('not found') &&
                      !errorMessage.includes('quota');
    
    return {
      success: false,
      jobId: job.id,
      fileName,
      fileSize,
      duration,
      error: errorMessage,
      retryable,
    };
  }
}

// Create the worker
export const transferWorker = new Worker<TransferJobData, TransferJobResult>(
  transferQueue.name,
  processTransfer,
  workerOptions
);

// Event handlers
transferWorker.on('completed', (job, result) => {
  console.log(`[TransferWorker] Job ${job?.id} completed: ${result?.success ? 'success' : 'failed'}`);
  
  // Emit SSE event or websocket message for UI notification
  // This would be picked up by the tray/toast system
});

transferWorker.on('failed', (job, error) => {
  console.error(`[TransferWorker] Job ${job?.id} failed: ${error.message}`);
});

transferWorker.on('progress', (job, progress) => {
  console.log(`[TransferWorker] Job ${job?.id} progress: ${progress}%`);
  
  // Emit progress update via SSE/websocket
});

transferWorker.on('error', (error) => {
  console.error(`[TransferWorker] Worker error: ${error.message}`);
});

/**
 * Get worker stats
 */
export async function getWorkerStats(): Promise<{
  isPaused: boolean;
  runningJobs: number;
}> {
  const isPaused = await transferWorker.isPaused();
  const runningJobs = await transferWorker.getActiveCount();
  
  return { isPaused, runningJobs };
}

/**
 * Gracefully shut down the worker
 */
export async function shutdownWorker(): Promise<void> {
  await transferWorker.close();
  await connection.quit();
  console.log('[TransferWorker] Worker shut down');
}

// Handle process signals
process.on('SIGTERM', shutdownWorker);
process.on('SIGINT', shutdownWorker);

export default transferWorker;
