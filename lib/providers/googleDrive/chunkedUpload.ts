/**
 * Google Drive resumable (chunked) upload — files >50 MB.
 *
 * Uses the Google Drive resumable upload API:
 *   POST https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable
 *   PUT  <uploadUrl>  (one request per chunk, Content-Range header)
 *
 * Gate: TRANSFER-1
 * Task: 3.5
 *
 * References:
 *   https://developers.google.com/drive/api/guides/manage-uploads#resumable
 */

import { Readable } from 'stream'
import { AppError } from '../../errors/AppError'
import { ErrorCode } from '../../errors/ErrorCode'
import type { ProviderAuthState, ProviderFile, ProviderOperationContext } from '../types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

/**
 * Google Drive recommends multiples of 256 KiB.
 * Default: 8 MiB — a safe balance between request count and memory pressure.
 */
export const GOOGLE_DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024 // 8 MiB

/** Threshold above which the chunked path is preferred (50 MB). */
export const CHUNKED_UPLOAD_THRESHOLD = 50 * 1024 * 1024 // 50 MiB

/** Maximum number of retry attempts for a single chunk on transient errors. */
const MAX_CHUNK_RETRIES = 3

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GoogleDriveChunkedUploadOptions {
  /** Operation context (requestId, userId, abortSignal). */
  context: ProviderOperationContext
  /** OAuth2 auth state — must contain a valid `accessToken`. */
  auth: ProviderAuthState
  /** Parent folder ID. Omit to place in root ("My Drive"). */
  parentId?: string
  /** Destination file name. */
  fileName: string
  /** MIME type. Defaults to `application/octet-stream`. */
  contentType?: string
  /** Total byte length of the file — required by the Google API. */
  contentLength: number
  /** Readable stream of the file data. */
  stream: Readable
  /**
   * Chunk size in bytes. Must be a multiple of 256 KiB.
   * Defaults to {@link GOOGLE_DEFAULT_CHUNK_SIZE}.
   */
  chunkSize?: number
  /** Optional callback invoked after each committed chunk. */
  onProgress?: (opts: { uploadedBytes: number; totalBytes: number; percentage: number }) => void
}

export interface GoogleDriveChunkedUploadResult {
  file: ProviderFile
  /** Bytes committed by the provider across all chunks. */
  uploadedBytes: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Initiate a resumable upload session and return the upload URL.
 * The URL is the sole token needed to push chunks — no auth header required
 * for subsequent PUT requests to this URL.
 */
async function initiateResumableSession(opts: {
  accessToken: string
  parentId: string | undefined
  fileName: string
  mimeType: string
  contentLength: number
  signal: AbortSignal | undefined
}): Promise<string> {
  const metadata: Record<string, unknown> = { name: opts.fileName }
  if (opts.parentId) {
    metadata['parents'] = [opts.parentId]
  }

  const res = await fetch(`${GOOGLE_UPLOAD_API}/files?uploadType=resumable`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
      'X-Upload-Content-Type': opts.mimeType,
      'X-Upload-Content-Length': String(opts.contentLength),
    },
    body: JSON.stringify(metadata),
    signal: opts.signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new AppError({
      code:
        res.status === 401
          ? ErrorCode.UNAUTHORIZED
          : res.status === 429
            ? ErrorCode.RATE_LIMITED
            : ErrorCode.PROVIDER_UNAVAILABLE,
      message: `Google Drive: failed to initiate resumable upload session: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status === 429 || res.status >= 500,
    })
  }

  const uploadUrl = res.headers.get('location')
  if (!uploadUrl) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Google Drive: resumable upload session response missing Location header',
    })
  }

  return uploadUrl
}

/**
 * Query the upload URL for the current committed byte offset.
 * Returns the number of bytes the server has already received.
 * Returns 0 if no bytes have been committed yet (fresh session).
 */
async function queryUploadStatus(opts: {
  uploadUrl: string
  contentLength: number
  signal: AbortSignal | undefined
}): Promise<number> {
  const res = await fetch(opts.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Range': `bytes */${opts.contentLength}`,
      'Content-Length': '0',
    },
    signal: opts.signal,
  })

  // 308 Resume Incomplete — server tells us where to resume
  if (res.status === 308) {
    const rangeHeader = res.headers.get('range')
    if (!rangeHeader) return 0
    return Number(rangeHeader.split('-')[1]) + 1
  }

  // 200 / 201 — upload already complete
  if (res.status === 200 || res.status === 201) {
    return opts.contentLength
  }

  throw new AppError({
    code: ErrorCode.CHUNK_FAILED,
    message: `Google Drive: unexpected status when querying upload status: ${res.status}`,
    statusCode: res.status,
    retryable: res.status >= 500,
  })
}

/**
 * Upload a single chunk with retry on transient (5xx / 429) errors.
 * Returns the committed byte offset after this chunk.
 */
async function uploadChunk(opts: {
  uploadUrl: string
  chunk: Buffer
  offset: number
  totalSize: number
  isFinalChunk: boolean
  signal: AbortSignal | undefined
}): Promise<{ committedOffset: number; completed: boolean; rawData?: Record<string, unknown> }> {
  const rangeEnd = opts.offset + opts.chunk.length - 1
  const totalStr = opts.isFinalChunk ? String(opts.totalSize) : '*'

  let lastError: Error | undefined

  for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
    const res = await fetch(opts.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${opts.offset}-${rangeEnd}/${totalStr}`,
        'Content-Length': String(opts.chunk.length),
        'Content-Type': 'application/octet-stream',
      },
      body: opts.chunk as unknown as BodyInit,
      signal: opts.signal,
    })

    // 200 or 201 → upload complete, body contains the file metadata
    if (res.status === 200 || res.status === 201) {
      const rawData = (await res.json()) as Record<string, unknown>
      return {
        committedOffset: opts.offset + opts.chunk.length,
        completed: true,
        rawData,
      }
    }

    // 308 Resume Incomplete → chunk accepted, more chunks expected
    if (res.status === 308) {
      const rangeHeader = res.headers.get('range')
      const committedOffset = rangeHeader
        ? Number(rangeHeader.split('-')[1]) + 1
        : opts.offset + opts.chunk.length
      return { committedOffset, completed: false }
    }

    // 5xx / 429 → transient; retry after brief back-off
    if (res.status === 429 || res.status >= 500) {
      const text = await res.text()
      lastError = new AppError({
        code: res.status === 429 ? ErrorCode.RATE_LIMITED : ErrorCode.CHUNK_FAILED,
        message: `Google Drive: chunk upload attempt ${attempt + 1} failed: ${res.status} ${text}`,
        statusCode: res.status,
        retryable: true,
      })
      // Exponential back-off: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      continue
    }

    // 4xx (non-429) → permanent failure
    const text = await res.text()
    throw new AppError({
      code: ErrorCode.CHUNK_FAILED,
      message: `Google Drive: chunk upload failed permanently: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: false,
    })
  }

  throw (
    lastError ??
    new AppError({
      code: ErrorCode.CHUNK_FAILED,
      message: `Google Drive: chunk upload exhausted ${MAX_CHUNK_RETRIES} retries`,
      retryable: false,
    })
  )
}

/**
 * Map raw Google Drive API file metadata to the canonical `ProviderFile` shape.
 */
function toProviderFile(raw: Record<string, unknown>, fallbackSize: number): ProviderFile {
  return {
    id: raw['id'] as string,
    name: raw['name'] as string,
    isFolder: raw['mimeType'] === 'application/vnd.google-apps.folder',
    size: raw['size'] !== undefined ? Number(raw['size']) : fallbackSize,
    parentId: Array.isArray(raw['parents']) ? (raw['parents'][0] as string) : undefined,
    mimeType: raw['mimeType'] as string | undefined,
    etag: raw['md5Checksum'] as string | undefined,
    checksum: raw['md5Checksum'] as string | undefined,
    createdAt: raw['createdTime'] as string | undefined,
    modifiedAt: raw['modifiedTime'] as string | undefined,
    webUrl: raw['webViewLink'] as string | undefined,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Perform a chunked (resumable) upload to Google Drive for files >50 MB.
 *
 * Flow:
 *  1. Initiate a resumable session → get upload URL.
 *  2. Buffer the stream and split into `chunkSize` pieces.
 *  3. PUT each chunk with `Content-Range`.  308 → more chunks; 200/201 → done.
 *  4. Return the canonical `ProviderFile` from the final 200/201 response body.
 *
 * The function is abort-signal aware: if `context.abortSignal` fires mid-upload,
 * the in-flight fetch is cancelled and an `AppError(TRANSFER_FAILED)` is thrown.
 *
 * @throws {AppError} with one of the codes documented in `ProviderAdapterErrorCode`.
 */
export async function googleDriveChunkedUpload(
  opts: GoogleDriveChunkedUploadOptions,
): Promise<GoogleDriveChunkedUploadResult> {
  const {
    context,
    auth,
    parentId,
    fileName,
    contentType,
    contentLength,
    stream,
    chunkSize = GOOGLE_DEFAULT_CHUNK_SIZE,
    onProgress,
  } = opts

  const mimeType = contentType ?? 'application/octet-stream'
  const signal = context.abortSignal

  // Step 1 — Initiate resumable session
  const uploadUrl = await initiateResumableSession({
    accessToken: auth.accessToken,
    parentId,
    fileName,
    mimeType,
    contentLength,
    signal,
  })

  // Step 2 — Buffer and chunk the stream
  const rawChunks: Buffer[] = []
  for await (const piece of stream) {
    rawChunks.push(Buffer.isBuffer(piece) ? piece : Buffer.from(piece as Uint8Array))
  }
  const fullBuffer = Buffer.concat(rawChunks)

  const chunks: Buffer[] = []
  for (let i = 0; i < fullBuffer.length; i += chunkSize) {
    chunks.push(fullBuffer.subarray(i, Math.min(i + chunkSize, fullBuffer.length)))
  }

  if (chunks.length === 0) {
    throw new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'Google Drive chunked upload: stream produced no data',
    })
  }

  // Step 3 — Upload chunks
  let committedOffset = 0
  let finalFileData: Record<string, unknown> | undefined

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!
    const isFinalChunk = i === chunks.length - 1
    const offset = i * chunkSize

    const result = await uploadChunk({
      uploadUrl,
      chunk,
      offset,
      totalSize: contentLength,
      isFinalChunk,
      signal,
    })

    committedOffset = result.committedOffset

    if (result.completed) {
      finalFileData = result.rawData
    }

    onProgress?.({
      uploadedBytes: committedOffset,
      totalBytes: contentLength,
      percentage: Math.min(100, Math.round((committedOffset / contentLength) * 100)),
    })
  }

  // Step 4 — Verify completion and build result
  if (!finalFileData) {
    // Chunks were accepted (308s) but the final chunk did not return 200/201.
    // Query status to confirm or surface the error.
    const serverOffset = await queryUploadStatus({ uploadUrl, contentLength, signal })
    if (serverOffset < contentLength) {
      throw new AppError({
        code: ErrorCode.TRANSFER_FAILED,
        message: `Google Drive chunked upload: upload incomplete — server reports ${serverOffset}/${contentLength} bytes committed`,
        retryable: true,
      })
    }
    // Upload is complete but we have no metadata (should not happen with valid chunkSize).
    return {
      file: {
        id: uploadUrl,
        name: fileName,
        isFolder: false,
        size: contentLength,
        mimeType,
      },
      uploadedBytes: contentLength,
    }
  }

  return {
    file: toProviderFile(finalFileData, contentLength),
    uploadedBytes: committedOffset,
  }
}
