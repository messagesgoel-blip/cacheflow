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

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const JOB_TYPES = ['transfer', 'rate_limit', 'scheduled'] as const;

const PROGRESS_CHANNEL_PREFIX = 'progress:';
const LOG_CHANNEL_PREFIX = 'logs:';

export interface ProgressUpdate {
  jobId: string;
  jobType: 'transfer' | 'rate_limit' | 'scheduled';
  userId: string;
  progress: number | Record<string, unknown>;
  status: 'progress' | 'completed' | 'failed';
  timestamp: number;
  data?: TransferJobData;
  result?: TransferJobResult;
  error?: string;
}

/** Log entry for worker events */
export interface WorkerLogEntry {
  jobId: string;
  jobType: 'transfer' | 'rate_limit' | 'scheduled';
  userId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp?: number;
  data?: Record<string, unknown>;
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

export interface LogSubscriber {
  userId: string;
  jobId?: string;
  onLog: (entry: WorkerLogEntry) => void;
  onError: (error: Error) => void;
}

class ProgressBridge {
  private publisher: Redis;
  private subscriber: Redis;
  private subscriptions: Map<string, Set<ProgressSubscriber>> = new Map();
  private logSubscriptions: Map<string, Set<LogSubscriber>> = new Map();
  private initialized = false;

  constructor() {
    const redisOptions = {
      db: 1,
      retryStrategy: (attempt: number) => Math.min(attempt * 100, 2_000),
      reconnectOnError: () => true,
    };

    this.publisher = new Redis(REDIS_URL, redisOptions);
    this.subscriber = new Redis(REDIS_URL, redisOptions);

    this.attachRedisListeners(this.publisher, 'publisher');
    this.attachRedisListeners(this.subscriber, 'subscriber');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    for (const jobType of JOB_TYPES) {
      await this.subscriber.subscribe(PROGRESS_CHANNEL_PREFIX + jobType);
      await this.subscriber.subscribe(LOG_CHANNEL_PREFIX + jobType);
    }

    this.subscriber.on('message', (channel, message) => {
      this.handleMessage(channel, message);
    });

    this.initialized = true;
    console.log('[ProgressBridge] Initialized');
  }

  private handleMessage(channel: string, message: string): void {
    try {
      // Check if this is a log message
      if (channel.startsWith(LOG_CHANNEL_PREFIX)) {
        const entry: WorkerLogEntry = JSON.parse(message);
        this.notifyLogSubscribers(entry);
        return;
      }

      // Otherwise it's a progress message
      const update: ProgressUpdate = JSON.parse(message);
      this.notifySubscribers(update);
    } catch (error) {
      console.error('[ProgressBridge] Failed to parse message:', error);
    }
  }

  private attachRedisListeners(client: Redis, label: 'publisher' | 'subscriber'): void {
    client.on('connect', () => {
      console.log(`[ProgressBridge] Redis ${label} connected`);
    });

    client.on('reconnecting', (delay: number) => {
      console.warn(`[ProgressBridge] Redis ${label} reconnecting in ${delay}ms`);
    });

    client.on('end', () => {
      console.warn(`[ProgressBridge] Redis ${label} connection ended`);
    });

    client.on('error', (error) => {
      console.error(`[ProgressBridge] Redis ${label} error:`, error);
    });
  }

  private ensureInitialized(methodName: string): void {
    if (!this.initialized) {
      throw new Error(`[ProgressBridge] ${methodName} called before initialize()`);
    }
  }

  private notifyLogSubscribers(entry: WorkerLogEntry): void {
    const userKey = entry.userId;
    const jobKey = `${entry.userId}:${entry.jobId}`;

    const userSubs = this.logSubscriptions.get(userKey);
    const jobSubs = this.logSubscriptions.get(jobKey);

    const allSubs = new Set([...(userSubs || []), ...(jobSubs || [])]);

    for (const sub of allSubs) {
      if (!sub.jobId || sub.jobId === entry.jobId) {
        try {
          sub.onLog(entry);
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          sub.onError(err);
        }
      }
    }
  }

  private notifySubscribers(update: ProgressUpdate): void {
    const userKey = update.userId;
    const jobKey = `${update.userId}:${update.jobId}`;

    const userSubs = this.subscriptions.get(userKey);
    const jobSubs = this.subscriptions.get(jobKey);

    const allSubs = new Set([...(userSubs || []), ...(jobSubs || [])]);

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
    this.ensureInitialized('publishProgress');

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

  // --- Log event publishing ---

  async publishWorkerLog(entry: WorkerLogEntry): Promise<void> {
    this.ensureInitialized('publishWorkerLog');

    const channel = LOG_CHANNEL_PREFIX + (entry.jobType || 'transfer');
    const message = JSON.stringify({
      ...entry,
      timestamp: Date.now(),
    });
    await this.publisher.publish(channel, message);
  }

  async publishTransferLog(
    jobId: string,
    userId: string,
    level: WorkerLogEntry['level'],
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await this.publishWorkerLog({
      jobId,
      jobType: 'transfer',
      userId,
      level,
      message,
      data,
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

  // --- Log subscription methods (LOGS-1) ---

  subscribeToLog(subscriber: LogSubscriber): () => void {
    const key = subscriber.jobId
      ? `${subscriber.userId}:${subscriber.jobId}`
      : subscriber.userId;

    if (!this.logSubscriptions.has(key)) {
      this.logSubscriptions.set(key, new Set());
    }

    this.logSubscriptions.get(key)!.add(subscriber);

    return () => {
      const subs = this.logSubscriptions.get(key);
      if (subs) {
        subs.delete(subscriber);
        if (subs.size === 0) {
          this.logSubscriptions.delete(key);
        }
      }
    };
  }

  subscribeToJobLogs(
    userId: string,
    jobId: string,
    onLog: (entry: WorkerLogEntry) => void,
    onError: (error: Error) => void
  ): () => void {
    return this.subscribeToLog({ userId, jobId, onLog, onError });
  }

  subscribeToUserLogs(
    userId: string,
    onLog: (entry: WorkerLogEntry) => void,
    onError: (error: Error) => void
  ): () => void {
    return this.subscribeToLog({ userId, onLog, onError });
  }

  async shutdown(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
    this.subscriptions.clear();
    this.logSubscriptions.clear();
    this.initialized = false;
    console.log('[ProgressBridge] Shutdown complete');
  }
}

export const progressBridge = new ProgressBridge();

export function createProgressBridge(): ProgressBridge {
  return new ProgressBridge();
}
