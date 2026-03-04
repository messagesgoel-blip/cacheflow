import type {
  AbortResumableUploadRequest,
  ConnectRequest,
  ConnectResponse,
  CopyFileRequest,
  CopyFileResponse,
  CreateFolderRequest,
  CreateFolderResponse,
  CreateResumableUploadRequest,
  CreateResumableUploadResponse,
  CreateShareLinkRequest,
  CreateShareLinkResponse,
  DeleteFileRequest,
  DisconnectRequest,
  DownloadStreamRequest,
  DownloadStreamResponse,
  FinalizeResumableUploadRequest,
  FinalizeResumableUploadResponse,
  GetFileRequest,
  GetFileResponse,
  GetQuotaRequest,
  GetQuotaResponse,
  GetResumableUploadStatusRequest,
  GetResumableUploadStatusResponse,
  ListFilesRequest,
  ListFilesResponse,
  MoveFileRequest,
  MoveFileResponse,
  ProviderDescriptor,
  RefreshAuthRequest,
  RefreshAuthResponse,
  RenameFileRequest,
  RenameFileResponse,
  RevokeShareLinkRequest,
  SearchFilesRequest,
  SearchFilesResponse,
  UploadResumableChunkRequest,
  UploadResumableChunkResponse,
  UploadStreamRequest,
  UploadStreamResponse,
  ValidateAuthRequest,
  ValidateAuthResponse,
} from './types'

/**
 * Canonical provider contract for all server-side adapters.
 *
 * Notes:
 * - `downloadStream` and `uploadStream` are stream-only to enforce zero-disk transfer paths.
 * - Resumable upload methods are required for providers participating in transfer resume flows.
 * - Provider parity for AUTH-1 is defined by `PROVIDER_PARITY_CHECKLIST` (5 checks, all required).
 */
export interface ProviderAdapter {
  readonly descriptor: ProviderDescriptor

  connect(request: ConnectRequest): Promise<ConnectResponse>
  refreshAuth(request: RefreshAuthRequest): Promise<RefreshAuthResponse>
  disconnect(request: DisconnectRequest): Promise<void>
  validateAuth(request: ValidateAuthRequest): Promise<ValidateAuthResponse>

  getQuota(request: GetQuotaRequest): Promise<GetQuotaResponse>

  listFiles(request: ListFilesRequest): Promise<ListFilesResponse>
  searchFiles(request: SearchFilesRequest): Promise<SearchFilesResponse>
  getFile(request: GetFileRequest): Promise<GetFileResponse>

  createFolder(request: CreateFolderRequest): Promise<CreateFolderResponse>
  moveFile(request: MoveFileRequest): Promise<MoveFileResponse>
  copyFile(request: CopyFileRequest): Promise<CopyFileResponse>
  renameFile(request: RenameFileRequest): Promise<RenameFileResponse>
  deleteFile(request: DeleteFileRequest): Promise<void>

  downloadStream(request: DownloadStreamRequest): Promise<DownloadStreamResponse>
  uploadStream(request: UploadStreamRequest): Promise<UploadStreamResponse>

  createResumableUpload(request: CreateResumableUploadRequest): Promise<CreateResumableUploadResponse>
  uploadResumableChunk(request: UploadResumableChunkRequest): Promise<UploadResumableChunkResponse>
  getResumableUploadStatus(request: GetResumableUploadStatusRequest): Promise<GetResumableUploadStatusResponse>
  finalizeResumableUpload(request: FinalizeResumableUploadRequest): Promise<FinalizeResumableUploadResponse>
  abortResumableUpload(request: AbortResumableUploadRequest): Promise<void>

  createShareLink(request: CreateShareLinkRequest): Promise<CreateShareLinkResponse>
  revokeShareLink(request: RevokeShareLinkRequest): Promise<void>
}

export type ProviderParityCheckId =
  | 'auth_lifecycle'
  | 'file_discovery'
  | 'file_mutation'
  | 'stream_transfer'
  | 'resumable_transfer'

export interface ProviderParityCheck {
  id: ProviderParityCheckId
  title: string
  requiredMethods: ReadonlyArray<Exclude<keyof ProviderAdapter, 'descriptor'>>
}

/**
 * Canonical 5-check provider parity baseline.
 * Every provider must pass all checks to be considered parity-complete.
 */
export const PROVIDER_PARITY_CHECKLIST: ReadonlyArray<ProviderParityCheck> = [
  {
    id: 'auth_lifecycle',
    title: 'Auth lifecycle parity',
    requiredMethods: ['connect', 'validateAuth', 'refreshAuth', 'disconnect'],
  },
  {
    id: 'file_discovery',
    title: 'File discovery parity',
    requiredMethods: ['listFiles', 'searchFiles', 'getFile'],
  },
  {
    id: 'file_mutation',
    title: 'File mutation parity',
    requiredMethods: ['createFolder', 'moveFile', 'copyFile', 'renameFile', 'deleteFile'],
  },
  {
    id: 'stream_transfer',
    title: 'Stream transfer parity',
    requiredMethods: ['downloadStream', 'uploadStream'],
  },
  {
    id: 'resumable_transfer',
    title: 'Resumable transfer parity',
    requiredMethods: [
      'createResumableUpload',
      'uploadResumableChunk',
      'getResumableUploadStatus',
      'finalizeResumableUpload',
      'abortResumableUpload',
    ],
  },
]
