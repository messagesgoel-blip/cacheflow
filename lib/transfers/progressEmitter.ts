/**
 * Progress Emitter
 *
 * In-process EventEmitter fanout for SSE transfer-progress streams.
 * Wraps progressBridge so each SSE connection adds only a Node listener
 * (no extra Redis client per request).
 *
 * Gate: SSE-1
 * Task: 3.2@SSE-1
 */

import { EventEmitter } from 'events';
import { progressBridge, ProgressUpdate } from './progressBridge';

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
}

export const progressEmitter = new ProgressEmitter();

