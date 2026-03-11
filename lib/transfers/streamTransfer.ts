/**
 * Stream Transfer — zero-disk server-side transfer.
 *
 * Pipes bytes directly from a source ProviderAdapter's downloadStream into a
 * target ProviderAdapter's uploadStream (or chunked-upload path for large
 * files).  No bytes are ever written to the server filesystem.
 *
 * Gate: ZERODISK-1
 * Task: 3.9@ZERODISK-1
 */

import { PassThrough, Transform } from 'stream';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/ErrorCode';
import type { ProviderAdapter } from '../providers/ProviderAdapter.interface';
import type {
  DownloadStreamRequest,
  ProviderAuthState,
  ProviderFile,
  ProviderOperationContext,
  UploadStreamRequest,
} from '../providers/types';

// ---------------------------------------------------------------------------
// Throttle Transform Stream
// ---------------------------------------------------------------------------

/**
 * Creates a throttle transform stream that limits bytes per second.
 * Returns null if throttle is null/undefined/0 (unlimited).
 *
 * Uses token bucket algorithm:
 * - Each input chunk is accepted immediately (callback called once)
 * - Output is emitted over time based on available tokens
 * - Large chunks are split across multiple ticks
 * - Uses this.push() from within transform/flush callbacks only (valid Transform)
 */
export function createThrottleStream(
  maxBytesPerSecond: number | null | undefined,
): Transform | null {
  if (!maxBytesPerSecond || maxBytesPerSecond <= 0) {
    return null;
  }
  const rate = maxBytesPerSecond;

  const highWaterMark = 16 * 1024;
  const maxSliceSize = Math.max(1, Math.min(highWaterMark, Math.floor(rate)));

  class ThrottleTransform extends Transform {
    private availableTokens = rate;
    private lastRefill = Date.now();
    private pending: Array<{ chunk: Buffer; pos: number }> = [];
    private flushCallback: ((err?: Error | null) => void) | null = null;
    private timer: NodeJS.Timeout | null = null;
    private draining = false;

    constructor() {
      super({ highWaterMark });
    }

    private refillTokens(): void {
      const now = Date.now();
      const elapsed = now - this.lastRefill;
      const tokensToAdd = (elapsed / 1000) * rate;
      this.availableTokens = Math.min(rate, this.availableTokens + tokensToAdd);
      this.lastRefill = now;
    }

    private scheduleDrain(delayMs: number): void {
      if (this.timer) {
        return;
      }

      this.timer = setTimeout(() => {
        this.timer = null;
        this.drainPending();
      }, Math.max(1, delayMs));
    }

    private finalizeIfIdle(): void {
      if (this.flushCallback && this.pending.length === 0 && !this.timer && !this.draining) {
        const done = this.flushCallback;
        this.flushCallback = null;
        done(null);
      }
    }

    private drainPending(): void {
      if (this.draining) {
        return;
      }

      this.draining = true;
      this.refillTokens();

      while (this.pending.length > 0) {
        const current = this.pending[0];
        if (!current) {
          break;
        }
        const remaining = current.chunk.length - current.pos;

        if (remaining <= 0) {
          this.pending.shift();
          continue;
        }

        if (this.availableTokens < 1) {
          const delayMs = Math.ceil(((1 - this.availableTokens) / rate) * 1000);
          this.draining = false;
          this.scheduleDrain(delayMs);
          return;
        }

        const bytesToEmit = Math.min(
          remaining,
          Math.max(1, Math.floor(this.availableTokens)),
          maxSliceSize,
        );

        const nextPos = current.pos + bytesToEmit;
        const chunk = current.chunk.subarray(current.pos, nextPos);
        current.pos = nextPos;
        this.availableTokens -= bytesToEmit;

        if (current.pos >= current.chunk.length) {
          this.pending.shift();
        }

        const canContinue = this.push(chunk);
        if (!canContinue) {
          this.draining = false;
          return;
        }
      }

      this.draining = false;
      this.finalizeIfIdle();
    }

    override _read(size: number): void {
      super._read(size);
      if (this.pending.length > 0) {
        this.drainPending();
      }
    }

    override _transform(
      chunk: Buffer,
      _encoding: BufferEncoding,
      callback: (error?: Error | null) => void,
    ): void {
      this.pending.push({ chunk: Buffer.from(chunk), pos: 0 });
      callback(null);
      this.drainPending();
    }

    override _flush(callback: (error?: Error | null) => void): void {
      this.flushCallback = callback;
      this.drainPending();
      this.finalizeIfIdle();
    }

    override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.pending = [];
      this.flushCallback = null;
      callback(error);
    }
  }

  return new ThrottleTransform();
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Bytes below which a single-request uploadStream is used. (50 MiB) */
const CHUNKED_THRESHOLD = 50 * 1024 * 1024;

/** Default highWaterMark for PassThrough streams (64 KiB) — prevents unbounded memory growth. */
const DEFAULT_HIGH_WATER_MARK = 64 * 1024;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options for a server-side stream transfer. */
export interface StreamTransferOptions {
  /** Shared operation context (requestId, userId, optional AbortSignal). */
  context: ProviderOperationContext;

  /** Auth credentials for the source provider. */
  sourceAuth: ProviderAuthState;
  /** Adapter for the source (download) provider. */
  sourceAdapter: ProviderAdapter;
  /** File identifier on the source provider. */
  sourceFileId: string;

  /** Auth credentials for the target provider. */
  targetAuth: ProviderAuthState;
  /** Adapter for the target (upload) provider. */
  targetAdapter: ProviderAdapter;
  /** Parent folder ID on the target provider (undefined = root). */
  targetParentId?: string;
  /**
   * Desired file name on the target.  Defaults to the source file's name when
   * omitted (resolved after the download metadata is retrieved).
   */
  targetFileName?: string;
  /** MIME type hint for the target provider. */
  contentType?: string;

  /** Invoked on each progress tick as bytes flow through. */
  onProgress?: (progress: StreamTransferProgress) => void;

  /**
   * High water mark for the PassThrough stream. Controls memory usage during
   * streaming. Lower values = less memory but more frequent backpressure events.
   * Default: 64 KiB. For STREAM-1 compliance, must be set to prevent unbounded memory growth.
   */
  highWaterMark?: number;

  /**
   * Optional bandwidth throttle (bytes per second). When set, transfer speed is
   * limited to this rate. Null or undefined = unlimited.
   */
  throttle?: {
    maxBytesPerSecond: number | null;
  };
}

/** Per-tick progress payload forwarded to the caller. */
export interface StreamTransferProgress {
  /** Bytes confirmed written to the target so far. */
  transferredBytes: number;
  /** Total file size in bytes (from source metadata). */
  totalBytes: number;
  /** Integer 0–100. */
  percentage: number;
}

/** Returned by a successful {@link streamTransfer} call. */
export interface StreamTransferResult {
  /** Canonical file record created on the target provider. */
  targetFile: ProviderFile;
  /** Total bytes transferred. */
  transferredBytes: number;
  /** Wall-clock duration of the transfer, in milliseconds. */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Transfer a file from `sourceAdapter` to `targetAdapter` using a live stream
 * pipe — no intermediate disk write.
 *
 * Flow:
 *   1. Resolve source file metadata via `sourceAdapter.downloadStream`.
 *   2. Wire the download stream into a PassThrough to track byte counts.
 *   3. Feed the PassThrough into `targetAdapter.uploadStream`.
 *   4. Return the canonical target `ProviderFile` once the pipe drains.
 *
 * Files ≥ CHUNKED_THRESHOLD (50 MiB) use the target adapter's
 * `uploadStream` with a known `contentLength` so the adapter can internally
 * choose a resumable/chunked path if it supports one.  The stream itself
 * remains a single continuous pipe from source to target.
 *
 * @throws AppError(VALIDATION_FAILED)    — options missing required fields.
 * @throws AppError(PROVIDER_UNAVAILABLE) — source download failed.
 * @throws AppError(TRANSFER_FAILED)      — upload to target failed.
 * @throws AppError(INTERNAL_ERROR)       — unexpected stream or adapter error.
 */
export async function streamTransfer(
  opts: StreamTransferOptions,
): Promise<StreamTransferResult> {
  _validateOptions(opts);

  const {
    context,
    sourceAuth,
    sourceAdapter,
    sourceFileId,
    targetAuth,
    targetAdapter,
    targetParentId,
    targetFileName,
    contentType,
    onProgress,
    highWaterMark = DEFAULT_HIGH_WATER_MARK,
    throttle,
  } = opts;

  const startMs = Date.now();

  // ── 1. Open source download stream ─────────────────────────────────────
  let downloadResp;
  try {
    const downloadReq: DownloadStreamRequest = {
      context,
      auth: sourceAuth,
      fileId: sourceFileId,
    };
    downloadResp = await sourceAdapter.downloadStream(downloadReq);
  } catch (err) {
    throw new AppError({
      code: ErrorCode.PROVIDER_UNAVAILABLE,
      message: `streamTransfer: failed to open download stream from source — ${_errMsg(err)}`,
      cause: err,
      retryable: true,
    });
  }

  const { file: sourceFile, stream: downloadStream, contentLength } = downloadResp;
  const totalBytes = contentLength ?? sourceFile.size ?? 0;
  const fileName = targetFileName ?? sourceFile.name;

  // ── 2. Wire a PassThrough to count bytes without buffering ─────────────
  let transferredBytes = 0;
  const pass = new PassThrough({ highWaterMark });

  // Create optional throttle stream
  const throttleStream = createThrottleStream(throttle?.maxBytesPerSecond);

  downloadStream.on('data', (chunk: Buffer) => {
    transferredBytes += chunk.length;

    if (onProgress && totalBytes > 0) {
      onProgress({
        transferredBytes,
        totalBytes,
        percentage: Math.min(100, Math.round((transferredBytes / totalBytes) * 100)),
      });
    }
  });

  // Pipeline: download -> pass -> [throttle] -> upload
  if (throttleStream) {
    downloadStream.pipe(pass).pipe(throttleStream);
  } else {
    downloadStream.pipe(pass);
  }

  // Forward source stream errors into the PassThrough so the upload side
  // surfaces them cleanly rather than hanging.
  downloadStream.on('error', (err: Error) => {
    pass.destroy(err);
    if (throttleStream) {
      throttleStream.destroy(err);
    }
  });

  // ── 3. Upload via target adapter ────────────────────────────────────────
  const uploadStream = throttleStream || pass;

  const uploadReq: UploadStreamRequest = {
    context,
    auth: targetAuth,
    parentId: targetParentId,
    fileName,
    contentType: contentType ?? sourceFile.mimeType ?? 'application/octet-stream',
    // Pass the known length so providers that need it (e.g. resumable) can
    // use it.  When unknown (0) we omit it to avoid sending a wrong header.
    ...(totalBytes > 0 ? { contentLength: totalBytes } : {}),
    stream: uploadStream,
  };

  let uploadResp;
  try {
    uploadResp = await targetAdapter.uploadStream(uploadReq);
  } catch (err) {
    // Tear down the source pipe to avoid a memory leak.
    downloadStream.destroy();
    pass.destroy();
    if (throttleStream) {
      throttleStream.destroy();
    }

    throw new AppError({
      code: ErrorCode.TRANSFER_FAILED,
      message: `streamTransfer: upload to target failed — ${_errMsg(err)}`,
      cause: err,
      retryable: false,
    });
  }

  const durationMs = Date.now() - startMs;

  // Emit a final 100 % progress tick.
  if (onProgress) {
    onProgress({
      transferredBytes: totalBytes || transferredBytes,
      totalBytes: totalBytes || transferredBytes,
      percentage: 100,
    });
  }

  return {
    targetFile: uploadResp.file,
    transferredBytes,
    durationMs,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _validateOptions(opts: StreamTransferOptions): void {
  if (!opts.context?.requestId) {
    throw new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'streamTransfer: context.requestId is required',
    });
  }
  if (!opts.context?.userId) {
    throw new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'streamTransfer: context.userId is required',
    });
  }
  if (!opts.sourceAdapter) {
    throw new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'streamTransfer: sourceAdapter is required',
    });
  }
  if (!opts.sourceFileId) {
    throw new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'streamTransfer: sourceFileId is required',
    });
  }
  if (!opts.targetAdapter) {
    throw new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'streamTransfer: targetAdapter is required',
    });
  }
  if (!opts.sourceAuth?.accessToken) {
    throw new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'streamTransfer: sourceAuth.accessToken is required',
    });
  }
  if (!opts.targetAuth?.accessToken) {
    throw new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'streamTransfer: targetAuth.accessToken is required',
    });
  }
}

function _errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// Re-export threshold constant for callers that need to know it
// ---------------------------------------------------------------------------

export { CHUNKED_THRESHOLD as STREAM_TRANSFER_CHUNKED_THRESHOLD };
export { DEFAULT_HIGH_WATER_MARK as STREAM_TRANSFER_DEFAULT_HIGH_WATER_MARK };

/**
 * Parse HTTP Range header into ByteRange.
 * Returns null if header is missing or invalid.
 * 
 * For MEDIA-1 compliance: enables seekable media playback.
 */
export function parseRangeHeader(rangeHeader: string | null, totalSize: number): { start: number; end: number } | null {
  if (!rangeHeader || totalSize <= 0) return null;

  const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return null;

  const start = parseInt(match[1], 10);
  if (isNaN(start) || start < 0 || start >= totalSize) return null;

  let end: number;
  if (match[2] === '') {
    end = totalSize - 1;
  } else {
    end = parseInt(match[2], 10);
    if (isNaN(end) || end < start || end >= totalSize) return null;
  }

  return { start, end };
}

/**
 * Format Content-Range header value.
 */
export function formatContentRange(start: number, end: number, total: number): string {
  return `bytes ${start}-${end}/${total}`;
}

/**
 * Create streaming response headers for range requests.
 * Handles MEDIA-1 compliance for seekable media playback.
 * 
 * @returns Headers object with proper Content-Range, Accept-Ranges, etc.
 */
export function createStreamHeaders(
  contentLength: number,
  contentType: string,
  range: { start: number; end: number } | null,
  totalSize: number
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  };

  if (range) {
    headers['Content-Length'] = String(contentLength);
    headers['Content-Range'] = formatContentRange(range.start, range.end, totalSize);
  } else {
    headers['Content-Length'] = String(contentLength);
  }

  return headers;
}

/**
 * Calculate proper status code for streaming response.
 * Returns 206 for range requests, 200 for full content.
 */
export function getStreamStatus(hasRange: boolean, isValidRange: boolean): number {
  if (hasRange && !isValidRange) {
    return 416; // Range Not Satisfiable
  }
  return hasRange ? 206 : 200; // Partial Content : OK
}

/**
 * Memory-bounded streaming configuration.
 * STREAM-1 compliance: prevents unbounded memory growth.
 */
export interface StreamConfig {
  /** Buffer size for streaming operations. Default: 64KB */
  highWaterMark: number;
  /** Maximum memory in bytes to use for buffering. Default: 10MB */
  maxBufferBytes: number;
  /** Enable explicit backpressure handling */
  enableBackpressure: boolean;
}

export const DEFAULT_STREAM_CONFIG: StreamConfig = {
  highWaterMark: 64 * 1024,        // 64 KB
  maxBufferBytes: 10 * 1024 * 1024, // 10 MB
  enableBackpressure: true,
};

/**
 * Calculate optimal buffer size based on file size.
 * Larger files get larger buffers up to maxBufferBytes.
 */
export function calculateOptimalBufferSize(
  fileSize: number,
  config: StreamConfig = DEFAULT_STREAM_CONFIG
): number {
  if (fileSize <= 1024 * 1024) {
    return config.highWaterMark; // 64 KB for small files
  }
  if (fileSize <= 10 * 1024 * 1024) {
    return config.highWaterMark * 4; // 256 KB for medium files
  }
  if (fileSize <= 100 * 1024 * 1024) {
    return config.highWaterMark * 8; // 512 KB for large files
  }
  // Cap at maxBufferBytes for very large files
  return Math.min(config.maxBufferBytes, config.highWaterMark * 16);
}
