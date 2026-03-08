import { Readable } from 'stream'
import { ErrorCode } from '../errors/ErrorCode'

export type ProviderId =
  | 'google'
  | 'onedrive'
  | 'dropbox'
  | 'box'
  | 'pcloud'
  | 'filen'
  | 'yandex'
  | 'webdav'
  | 'vps'
  | 'local'

export type ProviderAuthType = 'oauth2' | 'basic' | 'token' | 'service_account' | 'none'

export interface ProviderCapabilities {
  supportsAuthRefresh: boolean
  supportsSearch: boolean
  supportsShareLinks: boolean
  supportsResumableUpload: boolean
  supportsChunkResume: boolean
  supportsStreamingTransfer: boolean
  supportsServerSideCopy: boolean
}

export interface ProviderDescriptor {
  id: ProviderId
  displayName: string
  authType: ProviderAuthType
  capabilities: ProviderCapabilities
}

export interface ProviderOperationContext {
  requestId: string
  userId: string
  abortSignal?: AbortSignal
}

export interface ProviderAuthState {
  accountId: string
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  scopes?: string[]
}

export interface ProviderAccountProfile {
  accountId: string
  email?: string
  displayName?: string
  avatarUrl?: string
}

export interface ConnectRequest {
  context: ProviderOperationContext
  callbackUrl?: string
  code?: string
  codeVerifier?: string
  state?: string
}

export interface ConnectResponse {
  account: ProviderAccountProfile
  auth: ProviderAuthState
}

export interface RefreshAuthRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
}

export interface RefreshAuthResponse {
  auth: ProviderAuthState
  refreshedAt: string
}

export interface DisconnectRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
}

export interface ValidateAuthRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
}

export interface ValidateAuthResponse {
  valid: boolean
  reason?: 'expired' | 'revoked' | 'insufficient_scope' | 'unknown'
  expiresAt?: string
}

export interface ProviderFile {
  id: string
  name: string
  isFolder: boolean
  size: number
  parentId?: string
  path?: string
  mimeType?: string
  etag?: string
  checksum?: string
  createdAt?: string
  modifiedAt?: string
  webUrl?: string
}

export interface ProviderShareLink {
  id: string
  url: string
  expiresAt?: string
  passwordProtected?: boolean
}

export interface ProviderQuota {
  usedBytes: number
  totalBytes: number
  freeBytes: number
}

export interface GetQuotaRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
}

export interface GetQuotaResponse {
  quota: ProviderQuota
}

export interface ListFilesRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  folderId?: string
  cursor?: string
  pageSize?: number
}

export interface ListFilesResponse {
  files: ProviderFile[]
  nextCursor?: string
  hasMore: boolean
}

export interface SearchFilesRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  query: string
  folderId?: string
  cursor?: string
  pageSize?: number
}

export interface SearchFilesResponse {
  files: ProviderFile[]
  nextCursor?: string
  hasMore: boolean
}

export interface GetFileRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  fileId: string
}

export interface GetFileResponse {
  file: ProviderFile
}

export interface CreateFolderRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  name: string
  parentId?: string
}

export interface CreateFolderResponse {
  folder: ProviderFile
}

export interface MoveFileRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  fileId: string
  newParentId: string
  newName?: string
}

export interface MoveFileResponse {
  file: ProviderFile
}

export interface CopyFileRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  fileId: string
  newParentId: string
  newName?: string
}

export interface CopyFileResponse {
  file: ProviderFile
}

export interface RenameFileRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  fileId: string
  newName: string
}

export interface RenameFileResponse {
  file: ProviderFile
}

export interface DeleteFileRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  fileId: string
}

export interface ByteRange {
  start: number
  end?: number
}

export interface DownloadStreamRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  fileId: string
  range?: ByteRange
}

export interface DownloadStreamResponse {
  file: ProviderFile
  stream: Readable
  contentLength?: number
}

export interface UploadStreamRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  parentId?: string
  fileName: string
  contentType?: string
  contentLength?: number
  checksum?: string
  overwrite?: boolean
  stream: Readable
}

export interface UploadStreamResponse {
  file: ProviderFile
}

export interface ResumableUploadSession {
  sessionId: string
  providerUploadId: string
  parentId?: string
  fileName: string
  contentType?: string
  contentLength: number
  chunkSize: number
  nextOffset: number
  expiresAt?: string
}

export interface CreateResumableUploadRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  parentId?: string
  fileName: string
  contentType?: string
  contentLength: number
  chunkSize: number
  checksum?: string
}

export interface CreateResumableUploadResponse {
  session: ResumableUploadSession
}

export type UploadChunkPayload = Buffer | Uint8Array | Readable

export interface UploadResumableChunkRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  session: ResumableUploadSession
  offset: number
  chunkLength: number
  payload: UploadChunkPayload
  checksum?: string
  isFinalChunk?: boolean
}

export interface UploadResumableChunkResponse {
  session: ResumableUploadSession
  committedOffset: number
  completed: boolean
}

export interface GetResumableUploadStatusRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  session: ResumableUploadSession
}

export interface GetResumableUploadStatusResponse {
  session: ResumableUploadSession
}

export interface FinalizeResumableUploadRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  session: ResumableUploadSession
}

export interface FinalizeResumableUploadResponse {
  session: ResumableUploadSession
  file: ProviderFile
}

export interface AbortResumableUploadRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  session: ResumableUploadSession
}

export interface CreateShareLinkRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  fileId: string
  expiresAt?: string
  password?: string
}

export interface CreateShareLinkResponse {
  link: ProviderShareLink
}

export interface RevokeShareLinkRequest {
  context: ProviderOperationContext
  auth: ProviderAuthState
  fileId: string
  linkId?: string
}

export type UploadUuidInjectionCategory =
  | 'request_tracking'
  | 'transfer_tracking'
  | 'resumable_session'
  | 'remote_config'
  | 'oauth_state'
  | 'qa_mock'
  | 'upload_path'
  | 'unknown'

export interface UploadUuidInjectionPoint {
  id: string
  filePath: string
  line: number
  expression: string
  snippet: string
  category: UploadUuidInjectionCategory
  affectsUploadPath: boolean
  notes: string
}

export interface UploadUuidAuditSummary {
  scannedFiles: number
  scannedLines: number
  injectionPoints: number
  uploadPathInjectionPoints: number
  hasBlockingUploadPathInjection: boolean
}

export interface UploadUuidAuditReport {
  gate: 'UUID-1'
  generatedAt: string
  points: UploadUuidInjectionPoint[]
  summary: UploadUuidAuditSummary
}

export type ProviderAdapterErrorCode =
  | ErrorCode.UNAUTHORIZED
  | ErrorCode.TOKEN_EXPIRED
  | ErrorCode.REFRESH_FAILED
  | ErrorCode.RATE_LIMITED
  | ErrorCode.PROVIDER_UNAVAILABLE
  | ErrorCode.QUOTA_EXCEEDED
  | ErrorCode.CHUNK_FAILED
  | ErrorCode.TRANSFER_FAILED
  | ErrorCode.NOT_FOUND
  | ErrorCode.CONFLICT
  | ErrorCode.VALIDATION_FAILED

export interface ProviderAdapterError {
  code: ProviderAdapterErrorCode
  message: string
  retryable: boolean
  statusCode?: number
  providerRequestId?: string
  details?: Record<string, unknown>
}

