/**
 * Progress Bridge
 * 
 * BullMQ → SSE bridge via Redis pub/sub
 * Bridges job progress from BullMQ workers to SSE streams.
 * 
 * Gate: SSE-1
 * Task: 0.7@SSE-1
 */

import Redis from 'ioredis';
import { getRedisClient, RedisNamespace } from '../redis/client';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const PROGRESS_CHANNEL_PREFIX = 'progress:';
const QUEUE_CHANNEL_PREFIX = 'queue:';

export interface ProgressUpdate {
  jobId: string;
  jobType: 'transfer' | 'rate_limit';
  userId: string;
  progress: number | Record<string, unknown>;
  status: 'progress' | 'completed' | 'failed';
  timestamp: number;
  data?: TransferJobData;
  result?: TransferJobResult;
  error?: string;
}

export interface TransferJobData {
  userId: string;
  sourceProvider: string;
  destProvider: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  operation: string;
}

export interface TransferJobResult {
  success: boolean;
  jobId: string;
  fileName: string;
  fileSize: number;
  duration: number;
  error?: string;
}

export interface ProgressSubscriber {
  userId: string;
  jobId?: string;
  onProgress: (update: ProgressUpdate) => void;
  onError: (error: Error) => void;
}

class ProgressBridge {
  private publisher: Redis;
  private subscriber: Redis;
  private subscriptions: Map<string, Set<ProgressSubscriber>> = new Map();
  private channelListeners: Map<string, Redis> = new Map();
  private initialized = false;

  constructor() {
    this.publisher = new Redis(REDIS_URL, { db: 1 });
    this.subscriber = new Redis(REDIS_URL, { db: 1 });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.subscriber.subscribe(PROGRESS_CHANNEL_PREFIX + 'transfer');
    await this.subscriber.subscribe(PROGRESS_CHANNEL_PREFIX + 'rate_limit');

    this.subscriber.on('message', (channel, message) => {
      this.handleMessage(channel, message);
    });

    this.initialized = true;
    console.log('[ProgressBridge] Initialized');
  }

  private handleMessage(channel: string, message: string): void {
    try {
      const update: ProgressUpdate = JSON.parse(message);
      const jobType = channel.replace(PROGRESS_CHANNEL_PREFIX, '');
      
      this.notifySubscribers(jobType, update);
    } catch (error) {
      console.error('[ProgressBridge] Failed to parse message:', error);
    }
  }

  private notifySubscribers(jobType: string, update: ProgressUpdate): void {
    const userKey = update.userId;
    const jobKey = `${update.userId}:${update.jobId}`;

    const userSubs = this.subscriptions.get(userKey);
    const jobSubs = this.subscriptions.get(jobKey);

    const allSubs = [...(userSubs || []), ...(jobSubs || [])];

    for (const sub of allSubs) {
      if (!sub.jobId || sub.jobId === update.jobId) {
        try {
          sub.onProgress(update);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          sub.onError(err);
        }
      }
    }
  }

  async publishProgress(update: ProgressUpdate): Promise<void> {
    const channel = PROGRESS_CHANNEL_PREFIX + (update.jobType || 'transfer');
    const message = JSON.stringify({
      ...update,
      timestamp: Date.now(),
    });

    await this.publisher.publish(channel, message);
  }

  async publishTransferProgress(
    jobId: string,
    userId: string,
    progress: number,
    data?: TransferJobData
  ): Promise<void> {
    await this.publishProgress({
      jobId,
      jobType: 'transfer',
      userId,
      progress,
      status: 'progress',
      timestamp: Date.now(),
      data,
    });
  }

  async publishTransferComplete(
    jobId: string,
    userId: string,
    result: TransferJobResult
  ): Promise<void> {
    await this.publishProgress({
      jobId,
      jobType: 'transfer',
      userId,
      progress: 100,
      status: 'completed',
      timestamp: Date.now(),
      result,
    });
  }

  async publishTransferFailed(
    jobId: string,
    userId: string,
    error: string
  ): Promise<void> {
    await this.publishProgress({
      jobId,
      jobType: 'transfer',
      userId,
      progress: 0,
      status: 'failed',
      timestamp: Date.now(),
      error,
    });
  }

  subscribe(subscriber: ProgressSubscriber): () => void {
    const key = subscriber.jobId 
      ? `${subscriber.userId}:${subscriber.jobId}` 
      : subscriber.userId;

    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }

    this.subscriptions.get(key)!.add(subscriber);

    return () => {
      const subs = this.subscriptions.get(key);
      if (subs) {
        subs.delete(subscriber);
        if (subs.size === 0) {
          this.subscriptions.delete(key);
        }
      }
    };
  }

  subscribeToJob(
    userId: string,
    jobId: string,
    onProgress: (update: ProgressUpdate) => void,
    onError: (error: Error) => void
  ): () => void {
    return this.subscribe({ userId, jobId, onProgress, onError });
  }

  subscribeToUser(
    userId: string,
    onProgress: (update: ProgressUpdate) => void,
    onError: (error: Error) => void
  ): () => void {
    return this.subscribe({ userId, onProgress, onError });
  }

  async shutdown(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
    this.subscriptions.clear();
    this.initialized = false;
    console.log('[ProgressBridge] Shutdown complete');
  }
}

export const progressBridge = new ProgressBridge();

export function createProgressBridge(): ProgressBridge {
  return new ProgressBridge();
}
