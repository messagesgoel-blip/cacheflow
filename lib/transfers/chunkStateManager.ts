/**
 * Chunk State Manager
 *
 * Tracks per-transfer chunk upload progress in Redis so interrupted uploads
 * can be resumed from the last successfully committed chunk.
 *
 * Redis key schema (namespace: transfer, db=2):
 *   chunk:state:{transferId}        — JSON hash: ChunkStateRecord
 *   chunk:done:{transferId}         — Redis SET of committed chunkIndex strings
 *
 * TTL: 24 hours from the last write.  If a client never resumes within 24 h,
 * the state is silently purged and the next attempt starts from chunk 0.
 *
 * Gate: TRANSFER-1
 * Task: 3.6@TRANSFER-1
 */

import { getRedisClient } from '../redis/client';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/ErrorCode';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATE_TTL_SECONDS = 24 * 60 * 60; // 24 h
const KEY_PREFIX_STATE = 'chunk:state:';
const KEY_PREFIX_DONE = 'chunk:done:';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Immutable metadata stored when the transfer is first registered. */
export interface ChunkStateRecord {
  /** Transfer / upload identifier (matches the route [id] param). */
  transferId: string;
  /** File name supplied by the client. */
  fileName: string;
  /** Total file size in bytes. */
  fileSize: number;
  /** Chunk size in bytes (constant across all chunks). */
  chunkSize: number;
  /** Total number of chunks ceil(fileSize / chunkSize). */
  totalChunks: number;
  /** Owner user id — used to prevent cross-user reads. */
  userId: string;
  /** Unix ms timestamp of the first registration. */
  createdAt: number;
  /** Unix ms timestamp of the most recent chunk commit. */
  updatedAt: number;
}

/** Snapshot of resume state returned to callers. */
export interface ChunkResumeState {
  record: ChunkStateRecord;
  /** Sorted ascending list of chunk indices already committed. */
  committedChunks: number[];
  /** The lowest chunk index not yet committed (= resume point). */
  nextChunkIndex: number;
  /** Whether every chunk has been committed. */
  complete: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stateKey(transferId: string): string {
  return `${KEY_PREFIX_STATE}${transferId}`;
}

function doneKey(transferId: string): string {
  return `${KEY_PREFIX_DONE}${transferId}`;
}

function parseRecord(raw: string | null): ChunkStateRecord | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ChunkStateRecord;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// ChunkStateManager
// ---------------------------------------------------------------------------

class ChunkStateManager {
  private get redis() {
    return getRedisClient('transfer');
  }

  /**
   * Register a new upload transfer.
   * Idempotent: if the transferId already exists the call is a no-op and the
   * existing state is returned so clients that retry registration do not lose
   * progress.
   *
   * @throws AppError(VALIDATION_FAILED) when chunkSize <= 0 or fileSize <= 0
   */
  async register(opts: {
    transferId: string;
    userId: string;
    fileName: string;
    fileSize: number;
    chunkSize: number;
  }): Promise<ChunkStateRecord> {
    const { transferId, userId, fileName, fileSize, chunkSize } = opts;

    if (fileSize <= 0) {
      throw new AppError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'ChunkStateManager.register: fileSize must be positive',
      });
    }
    if (chunkSize <= 0) {
      throw new AppError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'ChunkStateManager.register: chunkSize must be positive',
      });
    }

    const key = stateKey(transferId);

    // Check for existing registration — preserve progress on retry.
    const existing = parseRecord(await this.redis.get(key));
    if (existing !== null) {
      return existing;
    }

    const record: ChunkStateRecord = {
      transferId,
      userId,
      fileName,
      fileSize,
      chunkSize,
      totalChunks: Math.ceil(fileSize / chunkSize),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.redis.set(key, JSON.stringify(record), 'EX', STATE_TTL_SECONDS);
    return record;
  }

  /**
   * Mark a single chunk as successfully committed.
   *
   * - Validates that chunkIndex is within range.
   * - Refreshes the TTL on both keys so activity keeps the session alive.
   * - Updates `updatedAt` on the state record.
   *
   * @throws AppError(NOT_FOUND)         when the transferId is unknown / expired.
   * @throws AppError(VALIDATION_FAILED) when chunkIndex is out of range.
   * @throws AppError(FORBIDDEN)         when userId does not match the owner.
   */
  async markChunkDone(opts: {
    transferId: string;
    userId: string;
    chunkIndex: number;
  }): Promise<ChunkResumeState> {
    const { transferId, userId, chunkIndex } = opts;

    const key = stateKey(transferId);
    const raw = await this.redis.get(key);
    const record = parseRecord(raw);

    if (!record) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `ChunkStateManager: transfer ${transferId} not found or expired`,
        statusCode: 404,
      });
    }

    if (record.userId !== userId) {
      throw new AppError({
        code: ErrorCode.FORBIDDEN,
        message: 'ChunkStateManager: access denied',
        statusCode: 403,
      });
    }

    if (chunkIndex < 0 || chunkIndex >= record.totalChunks) {
      throw new AppError({
        code: ErrorCode.VALIDATION_FAILED,
        message: `ChunkStateManager: chunkIndex ${chunkIndex} out of range [0, ${record.totalChunks - 1}]`,
        statusCode: 400,
      });
    }

    const dKey = doneKey(transferId);

    // Atomic add to the committed set + refresh TTLs.
    await this.redis
      .pipeline()
      .sadd(dKey, String(chunkIndex))
      .expire(dKey, STATE_TTL_SECONDS)
      .getset(
        key,
        JSON.stringify({ ...record, updatedAt: Date.now() }),
      )
      .expire(key, STATE_TTL_SECONDS)
      .exec();

    // Re-read to get the authoritative committed set.
    return this._buildResumeState(transferId, { ...record, updatedAt: Date.now() });
  }

  /**
   * Query the current resume state for a transfer.
   *
   * @throws AppError(NOT_FOUND)  when the transferId is unknown / expired.
   * @throws AppError(FORBIDDEN)  when userId does not match the owner.
   */
  async getResumeState(opts: {
    transferId: string;
    userId: string;
  }): Promise<ChunkResumeState> {
    const { transferId, userId } = opts;

    const key = stateKey(transferId);
    const raw = await this.redis.get(key);
    const record = parseRecord(raw);

    if (!record) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: `ChunkStateManager: transfer ${transferId} not found or expired`,
        statusCode: 404,
      });
    }

    if (record.userId !== userId) {
      throw new AppError({
        code: ErrorCode.FORBIDDEN,
        message: 'ChunkStateManager: access denied',
        statusCode: 403,
      });
    }

    return this._buildResumeState(transferId, record);
  }

  /**
   * Purge all state for a transfer (called on explicit abort or completion cleanup).
   * Silently succeeds even when the keys do not exist.
   */
  async purge(transferId: string): Promise<void> {
    await this.redis.del(stateKey(transferId), doneKey(transferId));
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async _buildResumeState(
    transferId: string,
    record: ChunkStateRecord,
  ): Promise<ChunkResumeState> {
    const dKey = doneKey(transferId);
    const rawMembers = await this.redis.smembers(dKey);

    const committedChunks = rawMembers
      .map((m: string) => parseInt(m, 10))
      .filter((n: number) => !isNaN(n))
      .sort((a: number, b: number) => a - b);

    // nextChunkIndex = smallest non-negative integer not in committedChunks.
    const committed = new Set(committedChunks);
    let nextChunkIndex = 0;
    while (committed.has(nextChunkIndex) && nextChunkIndex < record.totalChunks) {
      nextChunkIndex++;
    }

    const complete = committedChunks.length >= record.totalChunks;

    return {
      record,
      committedChunks,
      nextChunkIndex,
      complete,
    };
  }
}

export const chunkStateManager = new ChunkStateManager();

