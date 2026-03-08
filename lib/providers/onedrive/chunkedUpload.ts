import { Readable } from 'stream'
import { AppError } from '../../errors/AppError'
import { ErrorCode } from '../../errors/ErrorCode'
import type { ProviderAuthState, ProviderFile, ProviderOperationContext } from '../types'

const GRAPH_API = 'https://graph.microsoft.com/v1.0'

export const ONEDRIVE_DEFAULT_CHUNK_SIZE = 10 * 1024 * 1024 // 10 MiB (must be multiple of 320 KiB)
export const CHUNKED_UPLOAD_THRESHOLD = 50 * 1024 * 1024   // 50 MiB

const MAX_CHUNK_RETRIES = 3

export interface OneDriveChunkedUploadOptions {
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

export interface OneDriveChunkedUploadResult {
  file: ProviderFile
  uploadedBytes: number
}

async function createUploadSession(opts: {
  accessToken: string
  parentId: string | undefined
  fileName: string
  contentLength: number
  signal: AbortSignal | undefined
}): Promise<{ uploadUrl: string; expiresAt: string | undefined }> {
  const parent = opts.parentId ? `/me/drive/items/${opts.parentId}` : '/me/drive/root'
  const endpoint = `${GRAPH_API}${parent}:/${encodeURIComponent(opts.fileName)}:/createUploadSession`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      item: {
        '@microsoft.graph.conflictBehavior': 'rename',
        name: opts.fileName,
      },
    }),
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
      message: `OneDrive: failed to create upload session: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status === 429 || res.status >= 500,
    })
  }

  const data = (await res.json()) as Record<string, unknown>
  const uploadUrl = data['uploadUrl'] as string

  if (!uploadUrl) {
    throw new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'OneDrive: upload session response missing uploadUrl',
    })
  }

  return {
    uploadUrl,
    expiresAt: data['expirationDateTime'] as string | undefined,
  }
}

async function queryUploadStatus(opts: {
  uploadUrl: string
  signal: AbortSignal | undefined
}): Promise<number> {
  const res = await fetch(opts.uploadUrl, {
    method: 'GET',
    signal: opts.signal,
  })

  if (!res.ok) {
    throw new AppError({
      code: ErrorCode.CHUNK_FAILED,
      message: `OneDrive: upload status query failed: ${res.status}`,
      statusCode: res.status,
      retryable: res.status >= 500,
    })
  }

  const data = (await res.json()) as Record<string, unknown>
  const nextRanges = data['nextExpectedRanges'] as string[] | undefined
  if (!nextRanges || nextRanges.length === 0) return 0
  return Number(nextRanges[0]!.split('-')[0])
}

function driveItemToProviderFile(raw: Record<string, unknown>, fallbackSize: number): ProviderFile {
  const fileField = raw['file'] as Record<string, unknown> | undefined
  const hashes = fileField?.['hashes'] as Record<string, string> | undefined

  return {
    id: raw['id'] as string,
    name: raw['name'] as string,
    isFolder: raw['folder'] !== undefined,
    size: raw['size'] !== undefined ? Number(raw['size']) : fallbackSize,
    parentId: (raw['parentReference'] as Record<string, string> | undefined)?.['id'],
    mimeType: fileField?.['mimeType'] as string | undefined,
    etag: raw['eTag'] as string | undefined,
    checksum: hashes?.['sha256Hash'] ?? hashes?.['quickXorHash'],
    createdAt: raw['createdDateTime'] as string | undefined,
    modifiedAt: raw['lastModifiedDateTime'] as string | undefined,
    webUrl: raw['webUrl'] as string | undefined,
  }
}

async function uploadChunk(opts: {
  uploadUrl: string
  chunk: Buffer
  offset: number
  totalSize: number
  signal: AbortSignal | undefined
}): Promise<{ committedOffset: number; completed: boolean; rawData?: Record<string, unknown> }> {
  const rangeEnd = opts.offset + opts.chunk.length - 1
  let lastError: Error | undefined

  for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
    const res = await fetch(opts.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${opts.offset}-${rangeEnd}/${opts.totalSize}`,
        'Content-Length': String(opts.chunk.length),
      },
      body: opts.chunk as unknown as BodyInit,
      signal: opts.signal,
    })

    // 200 or 201 → final chunk accepted, body is the DriveItem
    if (res.status === 200 || res.status === 201) {
      const rawData = (await res.json()) as Record<string, unknown>
      return {
        committedOffset: opts.offset + opts.chunk.length,
        completed: true,
        rawData,
      }
    }

    // 202 Accepted → intermediate chunk accepted
    if (res.status === 202) {
      const data = (await res.json()) as Record<string, unknown>
      const nextRanges = data['nextExpectedRanges'] as string[] | undefined
      const committedOffset = nextRanges?.[0]
        ? Number(nextRanges[0].split('-')[0])
        : opts.offset + opts.chunk.length
      return { committedOffset, completed: false }
    }

    // 429 / 5xx → transient
    if (res.status === 429 || res.status >= 500) {
      const text = await res.text()
      lastError = new AppError({
        code: res.status === 429 ? ErrorCode.RATE_LIMITED : ErrorCode.CHUNK_FAILED,
        message: `OneDrive: chunk upload attempt ${attempt + 1} failed: ${res.status} ${text}`,
        statusCode: res.status,
        retryable: true,
      })
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
      continue
    }

    // Other 4xx → permanent
    const text = await res.text()
    throw new AppError({
      code: ErrorCode.CHUNK_FAILED,
      message: `OneDrive: chunk upload failed permanently: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: false,
    })
  }

  throw (
    lastError ??
    new AppError({
      code: ErrorCode.CHUNK_FAILED,
      message: `OneDrive: chunk upload exhausted ${MAX_CHUNK_RETRIES} retries`,
      retryable: false,
    })
  )
}

export async function oneDriveChunkedUpload(
  opts: OneDriveChunkedUploadOptions,
): Promise<OneDriveChunkedUploadResult> {
  const {
    context,
    auth,
    parentId,
    fileName,
    contentLength,
    stream,
    chunkSize = ONEDRIVE_DEFAULT_CHUNK_SIZE,
    onProgress,
  } = opts

  const signal = context.abortSignal

  const { uploadUrl } = await createUploadSession({
    accessToken: auth.accessToken,
    parentId,
    fileName,
    contentLength,
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
      message: 'OneDrive chunked upload: stream produced no data',
    })
  }

  let committedOffset = 0
  let finalFileData: Record<string, unknown> | undefined

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!
    const offset = i * chunkSize

    const result = await uploadChunk({
      uploadUrl,
      chunk,
      offset,
      totalSize: contentLength,
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

  if (!finalFileData) {
    const serverOffset = await queryUploadStatus({ uploadUrl, signal })
    if (serverOffset < contentLength) {
      throw new AppError({
        code: ErrorCode.TRANSFER_FAILED,
        message: `OneDrive chunked upload: upload incomplete — server reports ${serverOffset}/${contentLength} bytes`,
        retryable: true,
      })
    }
    return {
      file: {
        id: uploadUrl,
        name: fileName,
        isFolder: false,
        size: contentLength,
        mimeType: opts.contentType ?? 'application/octet-stream',
      },
      uploadedBytes: contentLength,
    }
  }

  return {
    file: driveItemToProviderFile(finalFileData, contentLength),
    uploadedBytes: committedOffset,
  }
}

