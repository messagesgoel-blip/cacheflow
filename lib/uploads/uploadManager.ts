import { Readable } from 'stream'
import { AppError } from '../errors/AppError'
import { ErrorCode } from '../errors/ErrorCode'
import type { ProviderAdapter } from '../providers/ProviderAdapter.interface'
import type {
  ProviderAuthState,
  ProviderOperationContext,
  ResumableUploadSession,
  UploadStreamResponse,
} from '../providers/types'

export interface UploadRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  provider: ProviderAdapter
  parentId?: string
  originalFileName: string
  contentType?: string
  contentLength?: number
  stream: Readable
}

export interface ResumableUploadRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  provider: ProviderAdapter
  parentId?: string
  originalFileName: string
  contentType?: string
  contentLength: number
  chunkSize: number
  checksum?: string
}

export interface ChunkUploadRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  provider: ProviderAdapter
  session: ResumableUploadSession
  offset: number
  chunk: Buffer
  isFinalChunk: boolean
}

export interface UploadResult {
  fileId: string
  fileName: string
  size: number
  mimeType?: string
}

export interface ResumableSessionResult {
  session: ResumableUploadSession
}

export interface ChunkResult {
  session: ResumableUploadSession
  committedOffset: number
  completed: boolean
}

function assertOriginalName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new AppError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'originalFileName must be a non-empty string',
    })
  }
}

export async function uploadStream(request: UploadRequest): Promise<UploadResult> {
  const { context, auth, provider, parentId, originalFileName, contentType, contentLength, stream } = request

  assertOriginalName(originalFileName)

  const response: UploadStreamResponse = await provider.uploadStream({
    context,
    auth,
    parentId,
    fileName: originalFileName,
    contentType,
    contentLength,
    stream,
  })

  return {
    fileId: response.file.id,
    fileName: response.file.name,
    size: response.file.size,
    mimeType: response.file.mimeType,
  }
}

export async function createResumableUpload(
  request: ResumableUploadRequest,
): Promise<ResumableSessionResult> {
  const {
    context,
    auth,
    provider,
    parentId,
    originalFileName,
    contentType,
    contentLength,
    chunkSize,
    checksum,
  } = request

  assertOriginalName(originalFileName)

  const response = await provider.createResumableUpload({
    context,
    auth,
    parentId,
    fileName: originalFileName,
    contentType,
    contentLength,
    chunkSize,
    checksum,
  })

  return { session: response.session }
}

export async function uploadChunk(request: ChunkUploadRequest): Promise<ChunkResult> {
  const { context, auth, provider, session, offset, chunk, isFinalChunk } = request

  const response = await provider.uploadResumableChunk({
    context,
    auth,
    session,
    offset,
    chunkLength: chunk.length,
    payload: chunk,
    isFinalChunk,
  })

  return {
    session: response.session,
    committedOffset: response.committedOffset,
    completed: response.completed,
  }
}

export async function getUploadStatus(
  context: ProviderOperationContext,
  auth: ProviderAuthState,
  provider: ProviderAdapter,
  session: ResumableUploadSession,
): Promise<ResumableUploadSession> {
  const response = await provider.getResumableUploadStatus({ context, auth, session })
  return response.session
}

export async function finalizeUpload(
  context: ProviderOperationContext,
  auth: ProviderAuthState,
  provider: ProviderAdapter,
  session: ResumableUploadSession,
): Promise<UploadResult> {
  const response = await provider.finalizeResumableUpload({ context, auth, session })

  return {
    fileId: response.file.id,
    fileName: response.file.name,
    size: response.file.size,
    mimeType: response.file.mimeType,
  }
}

export async function abortUpload(
  context: ProviderOperationContext,
  auth: ProviderAuthState,
  provider: ProviderAdapter,
  session: ResumableUploadSession,
): Promise<void> {
  await provider.abortResumableUpload({ context, auth, session })
}

