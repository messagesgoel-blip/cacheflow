/**
 * Progress Emitter
 *
 * In-process EventEmitter fanout for SSE transfer-progress streams.
 * Wraps progressBridge so each SSE connection adds only a Node listener
 * (no extra Redis client per request).
 *
 * Gate: SSE-1
 * Task: 3.2@SSE-1, 6.2@LOGS-1
 */

import { EventEmitter } from 'events';
import { progressBridge, ProgressUpdate, WorkerLogEntry } from './progressBridge';

const MAX_LISTENERS = 500;

class ProgressEmitter extends EventEmitter {
  private initialized = false;

  constructor() {
    super();
    this.setMaxListeners(MAX_LISTENERS);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await progressBridge.initialize();
    this.initialized = true;
    console.log('[ProgressEmitter] Initialized');
  }

  onJobProgress(
    userId: string,
    jobId: string,
    handler: (update: ProgressUpdate) => void
  ): () => void {
    return progressBridge.subscribeToJob(
      userId,
      jobId,
      handler,
      (err) => console.error('[ProgressEmitter] job subscription error', err)
    );
  }

  onUserProgress(
    userId: string,
    handler: (update: ProgressUpdate) => void
  ): () => void {
    return progressBridge.subscribeToUser(
      userId,
      handler,
      (err) => console.error('[ProgressEmitter] user subscription error', err)
    );
  }

  /**
   * Subscribe to worker log events for a specific job.
   * LOGS-1: Enables terminal-style log streaming.
   */
  onJobLogs(
    userId: string,
    jobId: string,
    handler: (entry: WorkerLogEntry) => void
  ): () => void {
    return progressBridge.subscribeToJobLogs(
      userId,
      jobId,
      handler,
      (err) => console.error('[ProgressEmitter] job log subscription error', err)
    );
  }
}

export const progressEmitter = new ProgressEmitter();
