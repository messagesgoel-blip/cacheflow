import { Readable } from 'stream'
import { AppError } from '../../errors/AppError'
import { ErrorCode } from '../../errors/ErrorCode'
import type { ProviderAuthState, ProviderFile, ProviderOperationContext } from '../types'

const DBX_CONTENT_API = 'https://content.dropboxapi.com/2'

// Dropbox recommends 150 MiB chunks; min 1 B, max 150 MiB per append call.
export const DROPBOX_DEFAULT_CHUNK_SIZE = 150 * 1024 * 1024 // 150 MiB
export const CHUNKED_UPLOAD_THRESHOLD = 50 * 1024 * 1024    // 50 MiB

const MAX_CHUNK_RETRIES = 3

export interface DropboxChunkedUploadOptions {
  context: ProviderOperationContext
  auth: ProviderAuthState
  parentId?: string
  fileName: string
  contentType?: string
  contentLength: number
  stream: Readable
  chunkSize?: number
  onProgress?: (opts: { uploadedBytes: number; totalBytes: number; percentage: number }) => void
}

export interface DropboxChunkedUploadResult {
  file: ProviderFile
  uploadedBytes: number
}

async function startUploadSession(opts: {
  accessToken: string
  signal: AbortSignal | undefined
}): Promise<string> {
  const res = await fetch(`${DBX_CONTENT_API}/files/upload_session/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ close: false }),
    },
    body: new Uint8Array(0) as unknown as BodyInit,
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
      message: `Dropbox: failed to start upload session: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status === 429 || res.status >= 500,
    })
  }

  const data = (await res.json()) as Record<string, unknown>
  const sessionId = data['session_id'] as string

  if (!sessionId) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Dropbox: upload session start response missing session_id',
    })
  }

  return sessionId
}

async function appendChunk(opts: {
  accessToken: string
  sessionId: string
  chunk: Buffer
  offset: number
  signal: AbortSignal | undefined
}): Promise<void> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
    const res = await fetch(`${DBX_CONTENT_API}/files/upload_session/append_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          cursor: { session_id: opts.sessionId, offset: opts.offset },
          close: false,
        }),
      },
      body: opts.chunk as unknown as BodyInit,
      signal: opts.signal,
    })

    // 200 with empty body → chunk accepted
    if (res.ok) return

    // 429 / 5xx → transient
    if (res.status === 429 || res.status >= 500) {
      const text = await res.text()
      lastError = new AppError({
        code: res.status === 429 ? ErrorCode.RATE_LIMITED : ErrorCode.CHUNK_FAILED,
        message: `Dropbox: append attempt ${attempt + 1} failed: ${res.status} ${text}`,
        statusCode: res.status,
        retryable: true,
      })
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      continue
    }

    // 4xx (non-429) → permanent
    const text = await res.text()
    throw new AppError({
      code: ErrorCode.CHUNK_FAILED,
      message: `Dropbox: append failed permanently: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: false,
    })
  }

  throw (
    lastError ??
    new AppError({
      code: ErrorCode.CHUNK_FAILED,
      message: `Dropbox: append exhausted ${MAX_CHUNK_RETRIES} retries`,
      retryable: false,
    })
  )
}

async function finishUploadSession(opts: {
  accessToken: string
  sessionId: string
  finalChunk: Buffer
  offset: number
  filePath: string
  signal: AbortSignal | undefined
}): Promise<Record<string, unknown>> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
    const res = await fetch(`${DBX_CONTENT_API}/files/upload_session/finish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          cursor: { session_id: opts.sessionId, offset: opts.offset },
          commit: { path: opts.filePath, mode: 'add', autorename: true },
        }),
      },
      body: opts.finalChunk as unknown as BodyInit,
      signal: opts.signal,
    })

    if (res.ok) {
      return (await res.json()) as Record<string, unknown>
    }

    if (res.status === 429 || res.status >= 500) {
      const text = await res.text()
      lastError = new AppError({
        code: res.status === 429 ? ErrorCode.RATE_LIMITED : ErrorCode.CHUNK_FAILED,
        message: `Dropbox: finish attempt ${attempt + 1} failed: ${res.status} ${text}`,
        statusCode: res.status,
        retryable: true,
      })
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      continue
    }

    const text = await res.text()
    throw new AppError({
      code: ErrorCode.TRANSFER_FAILED,
      message: `Dropbox: upload session finish failed permanently: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: false,
    })
  }

  throw (
    lastError ??
    new AppError({
      code: ErrorCode.TRANSFER_FAILED,
      message: `Dropbox: finish exhausted ${MAX_CHUNK_RETRIES} retries`,
      retryable: false,
    })
  )
}

function dropboxEntryToProviderFile(raw: Record<string, unknown>, fallbackSize: number): ProviderFile {
  const tag = raw['.tag'] as string

  return {
    id: (raw['id'] as string) ?? (raw['path_lower'] as string),
    name: raw['name'] as string,
    isFolder: tag === 'folder',
    size: raw['size'] !== undefined ? Number(raw['size']) : fallbackSize,
    path: raw['path_display'] as string | undefined,
    etag: raw['rev'] as string | undefined,
    checksum: raw['content_hash'] as string | undefined,
    createdAt: raw['client_modified'] as string | undefined,
    modifiedAt: raw['server_modified'] as string | undefined,
  }
}

export async function dropboxChunkedUpload(
  opts: DropboxChunkedUploadOptions,
): Promise<DropboxChunkedUploadResult> {
  const {
    context,
    auth,
    parentId,
    fileName,
    contentLength,
    stream,
    chunkSize = DROPBOX_DEFAULT_CHUNK_SIZE,
    onProgress,
  } = opts

  const signal = context.abortSignal
  const filePath = parentId ? `${parentId}/${fileName}` : `/${fileName}`

  const sessionId = await startUploadSession({
    accessToken: auth.accessToken,
    signal,
  })

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
      message: 'Dropbox chunked upload: stream produced no data',
    })
  }

  let committedOffset = 0

  // Append all chunks except the last using upload_session/append_v2
  for (let i = 0; i < chunks.length - 1; i++) {
    const chunk = chunks[i]!
    const offset = i * chunkSize

    await appendChunk({
      accessToken: auth.accessToken,
      sessionId,
      chunk,
      offset,
      signal,
    })

    committedOffset = offset + chunk.length

    onProgress?.({
      uploadedBytes: committedOffset,
      totalBytes: contentLength,
      percentage: Math.min(99, Math.round((committedOffset / contentLength) * 100)),
    })
  }

  // Finish with the final chunk using upload_session/finish
  const finalChunk = chunks[chunks.length - 1]!
  const finalOffset = (chunks.length - 1) * chunkSize

  const fileData = await finishUploadSession({
    accessToken: auth.accessToken,
    sessionId,
    finalChunk,
    offset: finalOffset,
    filePath,
    signal,
  })

  committedOffset = finalOffset + finalChunk.length

  onProgress?.({
    uploadedBytes: committedOffset,
    totalBytes: contentLength,
    percentage: 100,
  })

  return {
    file: dropboxEntryToProviderFile(fileData, contentLength),
    uploadedBytes: committedOffset,
  }
}

