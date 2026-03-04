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
