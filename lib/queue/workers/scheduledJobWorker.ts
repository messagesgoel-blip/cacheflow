import { Worker, Job, Queue } from 'bullmq';
import { getRedisClient } from '../../redis/client';
import { executeJob } from '../../jobs/jobEngine';

interface ScheduledJobData {
  jobId: string;
  jobType: string;
  payload: any;
  userId?: string;
  createdAt: Date;
}

class ScheduledJobWorker {
  private worker: Worker;
  private queue: Queue;

  constructor(queueName: string = 'scheduled-jobs') {
    const redisConnection = getRedisClient('workers');
    this.queue = new Queue(queueName, { connection: redisConnection as any });
    this.worker = new Worker(
      queueName,
      this.processJob.bind(this),
      {
        connection: redisConnection as any,
        concurrency: 5, // Handle up to 5 concurrent jobs
      }
    );

    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.worker.on('completed', (job: Job) => {
      console.log(`[ScheduledJobWorker] Job ${job.id} completed successfully`, {
        jobType: job.data.jobType,
        userId: job.data.userId,
        duration: job.finishedOn ? job.finishedOn - job.timestamp : undefined
      });
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      if (job) {
        console.error(`[ScheduledJobWorker] Job ${job.id} failed`, {
          jobType: job.data.jobType,
          userId: job.data.userId,
          error: err.message,
          stack: err.stack
        });
      } else {
        console.error('[ScheduledJobWorker] Unknown job failed', { error: err.message, stack: err.stack });
      }
    });

    this.worker.on('error', (err: Error) => {
      console.error('[ScheduledJobWorker] Scheduled job worker error', {
        error: err.message,
        stack: err.stack
      });
    });
  }

  private async processJob(job: Job<ScheduledJobData>) {
    const { jobId, jobType, payload, userId } = job.data;
    
    console.log(`[ScheduledJobWorker] Processing scheduled job ${jobId}`, {
      jobType,
      userId,
      attempts: job.attemptsMade
    });

    try {
      // Execute the job using the job engine
      const result = await executeJob(jobType, payload, userId);
      
      console.log(`[ScheduledJobWorker] Successfully executed scheduled job ${jobId}`, {
        jobType,
        userId,
        result: typeof result === 'object' ? Object.keys(result) : result
      });

      return result;
    } catch (error) {
      console.error(`[ScheduledJobWorker] Error executing scheduled job ${jobId}`, {
        jobType,
        userId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });

      throw error;
    }
  }

  public async addJob(
    jobType: string, 
    payload: any, 
    userId?: string,
    opts?: {
      delay?: number; // milliseconds to delay
      repeat?: {
        cron?: string; // cron pattern
        every?: number; // milliseconds interval
        timezone?: string;
      };
      jobId?: string; // custom job id
    }
  ): Promise<Job> {
    const jobData: ScheduledJobData = {
      jobId: opts?.jobId || `scheduled-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      jobType,
      payload,
      userId,
      createdAt: new Date()
    };

    const job = await this.queue.add(jobType, jobData, {
      jobId: opts?.jobId,
      delay: opts?.delay,
      repeat: opts?.repeat,
      attempts: 3, // Retry failed jobs up to 3 times
      backoff: {
        type: 'exponential',
        delay: 2000 // Start with 2 second delay, exponential backoff
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 1000 // Keep max 1000 completed jobs
      },
      removeOnFail: {
        age: 24 * 3600 // Keep failed jobs for 24 hours for debugging
      }
    });

    console.log(`[ScheduledJobWorker] Added scheduled job ${job.id}`, {
      jobType,
      userId,
      delay: opts?.delay,
      repeat: opts?.repeat
    });

    return job;
  }

  public async getJob(jobId: string): Promise<Job | null> {
    return (await this.queue.getJob(jobId)) ?? null;
  }

  public async removeJob(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job) {
      return false;
    }

    await job.remove();
    console.log(`[ScheduledJobWorker] Removed scheduled job ${jobId}`);
    return true;
  }

  public async getQueueMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount()
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed
    };
  }

  public async close(): Promise<void> {
    await this.worker.close();
    console.log('[ScheduledJobWorker] Scheduled job worker closed');
  }
}

// Global instance to be used throughout the application
let scheduledJobWorker: ScheduledJobWorker;

export const getScheduledJobWorker = (): ScheduledJobWorker => {
  if (!scheduledJobWorker) {
    scheduledJobWorker = new ScheduledJobWorker();
  }
  return scheduledJobWorker;
};

export default ScheduledJobWorker;
