import { Readable } from 'stream'
import { AppError } from '../errors/AppError'
import { ErrorCode } from '../errors/ErrorCode'
import * as trash from './dropbox/trash'
import type { ProviderAdapter } from './ProviderAdapter.interface'
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
  EmptyTrashRequest,
  FinalizeResumableUploadRequest,
  FinalizeResumableUploadResponse,
  GetFileRequest,
  GetFileResponse,
  GetQuotaRequest,
  GetQuotaResponse,
  GetResumableUploadStatusRequest,
  GetResumableUploadStatusResponse,
  ListFileVersionsRequest,
  ListFileVersionsResponse,
  ListFilesRequest,
  ListFilesResponse,
  ListTrashRequest,
  ListTrashResponse,
  MoveFileRequest,
  MoveFileResponse,
  ProviderDescriptor,
  ProviderFile,
  RefreshAuthRequest,
  RefreshAuthResponse,
  RenameFileRequest,
  RenameFileResponse,
  RestoreFileRequest,
  RestoreFileVersionRequest,
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

const DBX_API = 'https://api.dropboxapi.com/2'
const DBX_CONTENT_API = 'https://content.dropboxapi.com/2'
const DBX_AUTH_API = 'https://api.dropboxapi.com'

export const dropboxDescriptor: ProviderDescriptor = {
  id: 'dropbox',
  displayName: 'Dropbox',
  authType: 'oauth2',
  capabilities: {
    supportsAuthRefresh: true,
    supportsSearch: true,
    supportsShareLinks: true,
    supportsResumableUpload: true,
    supportsChunkResume: true,
    supportsStreamingTransfer: true,
    supportsServerSideCopy: true,
    supportsTrash: true,
    supportsVersioning: true,
  },
}

function dropboxEntryToProviderFile(raw: Record<string, unknown>): ProviderFile {
  const tag = raw['.tag'] as string

  return {
    id: (raw['id'] as string) ?? (raw['path_lower'] as string),
    name: raw['name'] as string,
    isFolder: tag === 'folder',
    size: raw['size'] !== undefined ? Number(raw['size']) : 0,
    path: raw['path_display'] as string | undefined,
    etag: raw['rev'] as string | undefined,
    checksum: raw['content_hash'] as string | undefined,
    createdAt: raw['client_modified'] as string | undefined,
    modifiedAt: raw['server_modified'] as string | undefined,
  }
}

async function dbxPost(
  endpoint: string,
  accessToken: string,
  argBody?: unknown,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${DBX_API}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: argBody !== undefined ? JSON.stringify(argBody) : undefined,
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new AppError({
      code:
        res.status === 401
          ? ErrorCode.UNAUTHORIZED
          : res.status === 429
            ? ErrorCode.RATE_LIMITED
            : res.status === 409
              ? ErrorCode.CONFLICT
              : ErrorCode.PROVIDER_UNAVAILABLE,
      message: `Dropbox POST ${endpoint} failed: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status === 429 || res.status >= 500,
    })
  }

  if (res.status === 200 && res.headers.get('content-length') === '0') {
    return {}
  }

  return res.json() as Promise<Record<string, unknown>>
}

async function dbxContentUpload(
  endpoint: string,
  accessToken: string,
  arg: unknown,
  body: Buffer,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${DBX_CONTENT_API}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify(arg),
    },
    body: body as unknown as BodyInit,
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new AppError({
      code:
        res.status === 401
          ? ErrorCode.UNAUTHORIZED
          : res.status === 429
            ? ErrorCode.RATE_LIMITED
            : res.status === 409
              ? ErrorCode.CONFLICT
              : ErrorCode.TRANSFER_FAILED,
      message: `Dropbox content upload ${endpoint} failed: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status === 429 || res.status >= 500,
    })
  }

  return res.json() as Promise<Record<string, unknown>>
}

async function collectStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
  }
  return Buffer.concat(chunks)
}

export class DropboxAdapter implements ProviderAdapter {
  readonly descriptor: ProviderDescriptor = dropboxDescriptor

  async connect(request: ConnectRequest): Promise<ConnectResponse> {
    const { context, code } = request

    if (!code) {
      throw new AppError({ code: ErrorCode.VALIDATION_FAILED, message: 'OAuth code required' })
    }

    const clientId = process.env['DROPBOX_CLIENT_ID']
    const clientSecret = process.env['DROPBOX_CLIENT_SECRET']
    const redirectUri = process.env['DROPBOX_REDIRECT_URI']

    if (!clientId || !clientSecret || !redirectUri) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'Dropbox OAuth env vars missing' })
    }

    const tokenRes = await fetch(`${DBX_AUTH_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
      signal: context.abortSignal,
    })

    if (!tokenRes.ok) {
      throw new AppError({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Dropbox OAuth token exchange failed',
        statusCode: tokenRes.status,
      })
    }

    const tokens = (await tokenRes.json()) as Record<string, unknown>
    const accessToken = tokens['access_token'] as string

    const profile = await dbxPost(
      '/users/get_current_account',
      accessToken,
      undefined,
      context.abortSignal,
    )

    const accountId = profile['account_id'] as string
    const name = profile['name'] as Record<string, string> | undefined

    return {
      account: {
        accountId,
        email: profile['email'] as string | undefined,
        displayName: name?.['display_name'],
        avatarUrl: (profile['profile_photo_url'] as string | undefined),
      },
      auth: {
        accountId,
        accessToken,
        refreshToken: tokens['refresh_token'] as string | undefined,
        expiresAt:
          tokens['expires_in'] !== undefined
            ? new Date(Date.now() + Number(tokens['expires_in']) * 1000).toISOString()
            : undefined,
      },
    }
  }

  async refreshAuth(request: RefreshAuthRequest): Promise<RefreshAuthResponse> {
    const { context, auth } = request

    if (!auth.refreshToken) {
      throw new AppError({ code: ErrorCode.REFRESH_FAILED, message: 'No refresh token available' })
    }

    const clientId = process.env['DROPBOX_CLIENT_ID']
    const clientSecret = process.env['DROPBOX_CLIENT_SECRET']

    if (!clientId || !clientSecret) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'Dropbox OAuth env vars missing' })
    }

    const res = await fetch(`${DBX_AUTH_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: auth.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }).toString(),
      signal: context.abortSignal,
    })

    if (!res.ok) {
      throw new AppError({
        code: ErrorCode.REFRESH_FAILED,
        message: 'Dropbox token refresh failed',
        statusCode: res.status,
      })
    }

    const tokens = (await res.json()) as Record<string, unknown>

    return {
      refreshedAt: new Date().toISOString(),
      auth: {
        ...auth,
        accessToken: tokens['access_token'] as string,
        expiresAt:
          tokens['expires_in'] !== undefined
            ? new Date(Date.now() + Number(tokens['expires_in']) * 1000).toISOString()
            : auth.expiresAt,
      },
    }
  }

  async disconnect(request: DisconnectRequest): Promise<void> {
    const { context, auth } = request
    await dbxPost('/auth/token/revoke', auth.accessToken, undefined, context.abortSignal)
  }

  async validateAuth(request: ValidateAuthRequest): Promise<ValidateAuthResponse> {
    const { context, auth } = request

    try {
      await dbxPost('/users/get_current_account', auth.accessToken, undefined, context.abortSignal)
      return { valid: true }
    } catch (err) {
      if (AppError.isAppError(err) && err.code === ErrorCode.UNAUTHORIZED) {
        return { valid: false, reason: 'expired' }
      }
      return { valid: false, reason: 'unknown' }
    }
  }

  async getQuota(request: GetQuotaRequest): Promise<GetQuotaResponse> {
    const { context, auth } = request

    const data = await dbxPost('/users/get_space_usage', auth.accessToken, undefined, context.abortSignal)

    const allocation = data['allocation'] as Record<string, unknown>
    const total = Number(allocation['allocated'] ?? 0)
    const used = Number(data['used'] ?? 0)

    return {
      quota: {
        usedBytes: used,
        totalBytes: total,
        freeBytes: Math.max(0, total - used),
      },
    }
  }

  async listFiles(request: ListFilesRequest): Promise<ListFilesResponse> {
    const { context, auth, folderId, cursor, pageSize = 100 } = request

    let data: Record<string, unknown>

    if (cursor) {
      data = await dbxPost(
        '/files/list_folder/continue',
        auth.accessToken,
        { cursor },
        context.abortSignal,
      )
    } else {
      data = await dbxPost(
        '/files/list_folder',
        auth.accessToken,
        {
          path: folderId ?? '',
          limit: pageSize,
          include_mounted_folders: true,
        },
        context.abortSignal,
      )
    }

    const entries = (data['entries'] as Record<string, unknown>[]) ?? []

    return {
      files: entries.map(dropboxEntryToProviderFile),
      nextCursor: data['has_more'] ? (data['cursor'] as string) : undefined,
      hasMore: Boolean(data['has_more']),
    }
  }

  async searchFiles(request: SearchFilesRequest): Promise<SearchFilesResponse> {
    const { context, auth, query, folderId, cursor, pageSize = 50 } = request

    let data: Record<string, unknown>

    if (cursor) {
      data = await dbxPost(
        '/files/search_v2/continue',
        auth.accessToken,
        { cursor },
        context.abortSignal,
      )
    } else {
      data = await dbxPost(
        '/files/search_v2',
        auth.accessToken,
        {
          query,
          options: {
            path: folderId ?? '',
            max_results: pageSize,
          },
        },
        context.abortSignal,
      )
    }

    const matches = (data['matches'] as Array<Record<string, unknown>>) ?? []
    const files = matches.map((m) => {
      const metadata = (m['metadata'] as Record<string, unknown>)?.['metadata'] as Record<string, unknown>
      return dropboxEntryToProviderFile(metadata ?? m)
    })

    return {
      files,
      nextCursor: data['has_more'] ? (data['cursor'] as string) : undefined,
      hasMore: Boolean(data['has_more']),
    }
  }

  async getFile(request: GetFileRequest): Promise<GetFileResponse> {
    const { context, auth, fileId } = request

    const data = await dbxPost(
      '/files/get_metadata',
      auth.accessToken,
      { path: fileId },
      context.abortSignal,
    )

    return { file: dropboxEntryToProviderFile(data) }
  }

  async createFolder(request: CreateFolderRequest): Promise<CreateFolderResponse> {
    const { context, auth, name, parentId } = request

    const folderPath = parentId ? `${parentId}/${name}` : `/${name}`

    const data = await dbxPost(
      '/files/create_folder_v2',
      auth.accessToken,
      { path: folderPath, autorename: false },
      context.abortSignal,
    )

    const metadata = (data['metadata'] as Record<string, unknown>) ?? data

    return { folder: dropboxEntryToProviderFile(metadata) }
  }

  async moveFile(request: MoveFileRequest): Promise<MoveFileResponse> {
    const { context, auth, fileId, newParentId, newName } = request

    const fromPath = fileId
    const fileName = newName ?? fileId.split('/').pop() ?? fileId
    const toPath = `${newParentId}/${fileName}`

    const data = await dbxPost(
      '/files/move_v2',
      auth.accessToken,
      { from_path: fromPath, to_path: toPath, autorename: false },
      context.abortSignal,
    )

    const metadata = (data['metadata'] as Record<string, unknown>) ?? data

    return { file: dropboxEntryToProviderFile(metadata) }
  }

  async copyFile(request: CopyFileRequest): Promise<CopyFileResponse> {
    const { context, auth, fileId, newParentId, newName } = request

    const fromPath = fileId
    const fileName = newName ?? fileId.split('/').pop() ?? fileId
    const toPath = `${newParentId}/${fileName}`

    const data = await dbxPost(
      '/files/copy_v2',
      auth.accessToken,
      { from_path: fromPath, to_path: toPath, autorename: false },
      context.abortSignal,
    )

    const metadata = (data['metadata'] as Record<string, unknown>) ?? data

    return { file: dropboxEntryToProviderFile(metadata) }
  }

  async renameFile(request: RenameFileRequest): Promise<RenameFileResponse> {
    const { context, auth, fileId, newName } = request

    const segments = fileId.split('/')
    segments[segments.length - 1] = newName
    const toPath = segments.join('/')

    const data = await dbxPost(
      '/files/move_v2',
      auth.accessToken,
      { from_path: fileId, to_path: toPath, autorename: false },
      context.abortSignal,
    )

    const metadata = (data['metadata'] as Record<string, unknown>) ?? data

    return { file: dropboxEntryToProviderFile(metadata) }
  }

  async deleteFile(request: DeleteFileRequest): Promise<void> {
    const { context, auth, fileId, permanent } = request
    if (permanent) {
      // Dropbox doesn't have a simple "permanent" flag in delete_v2.
      // Some accounts have a permanently_delete endpoint, but it's restricted.
      // We'll just use delete_v2 for now.
      await dbxPost('/files/delete_v2', auth.accessToken, { path: fileId }, context.abortSignal)
    } else {
      await dbxPost('/files/delete_v2', auth.accessToken, { path: fileId }, context.abortSignal)
    }
  }

  async listTrash(request: ListTrashRequest): Promise<ListTrashResponse> {
    return trash.listTrash(request)
  }

  async restoreFile(request: RestoreFileRequest): Promise<void> {
    return trash.restoreFile(request)
  }

  async emptyTrash(request: EmptyTrashRequest): Promise<void> {
    return trash.emptyTrash(request)
  }

  async listFileVersions(request: ListFileVersionsRequest): Promise<ListFileVersionsResponse> {
    return trash.listFileVersions(request)
  }

  async restoreFileVersion(request: RestoreFileVersionRequest): Promise<void> {
    return trash.restoreFileVersion(request)
  }

  async downloadStream(request: DownloadStreamRequest): Promise<DownloadStreamResponse> {
    const { context, auth, fileId, range } = request

    const headers: Record<string, string> = {
      Authorization: `Bearer ${auth.accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path: fileId }),
    }

    if (range) {
      const end = range.end !== undefined ? range.end : ''
      headers['Range'] = `bytes=${range.start}-${end}`
    }

    const res = await fetch(`${DBX_CONTENT_API}/files/download`, {
      method: 'POST',
      headers,
      signal: context.abortSignal,
    })

    if (!res.ok) {
      throw new AppError({
        code: ErrorCode.PROVIDER_UNAVAILABLE,
        message: `Dropbox download failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    if (!res.body) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'Dropbox response has no body' })
    }

    const metaHeader = res.headers.get('Dropbox-API-Result')
    const meta = metaHeader ? (JSON.parse(metaHeader) as Record<string, unknown>) : {}
    const stream = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
    const contentLength = res.headers.get('content-length')

    return {
      file: dropboxEntryToProviderFile(meta),
      stream,
      contentLength: contentLength ? Number(contentLength) : undefined,
    }
  }

  async uploadStream(request: UploadStreamRequest): Promise<UploadStreamResponse> {
    const { context, auth, parentId, fileName, stream } = request

    const filePath = parentId ? `${parentId}/${fileName}` : `/${fileName}`
    const body = await collectStream(stream)

    const data = await dbxContentUpload(
      '/files/upload',
      auth.accessToken,
      { path: filePath, mode: 'add', autorename: true },
      body,
      context.abortSignal,
    )

    return { file: dropboxEntryToProviderFile(data) }
  }

  async createResumableUpload(
    request: CreateResumableUploadRequest,
  ): Promise<CreateResumableUploadResponse> {
    const { context, auth, parentId, fileName, contentType, contentLength, chunkSize } = request

    const res = await fetch(`${DBX_CONTENT_API}/files/upload_session/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ close: false }),
      },
      body: new Uint8Array(0) as unknown as BodyInit,
      signal: context.abortSignal,
    })

    if (!res.ok) {
      throw new AppError({
        code: ErrorCode.PROVIDER_UNAVAILABLE,
        message: `Dropbox upload session start failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    const data = (await res.json()) as Record<string, unknown>
    const sessionId = data['session_id'] as string

    return {
      session: {
        sessionId: `dropbox-${context.requestId}`,
        providerUploadId: sessionId,
        parentId,
        fileName,
        contentType: contentType ?? 'application/octet-stream',
        contentLength,
        chunkSize,
        nextOffset: 0,
      },
    }
  }

  async uploadResumableChunk(request: UploadResumableChunkRequest): Promise<UploadResumableChunkResponse> {
    const { context, auth, session, offset, chunkLength, payload, isFinalChunk } = request

    let body: Buffer
    if (Buffer.isBuffer(payload)) {
      body = payload
    } else if (payload instanceof Uint8Array) {
      body = Buffer.from(payload)
    } else {
      body = await collectStream(payload as Readable)
    }

    const filePath = session.parentId
      ? `${session.parentId}/${session.fileName}`
      : `/${session.fileName}`

    if (isFinalChunk) {
      const res = await fetch(`${DBX_CONTENT_API}/files/upload_session/finish`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            cursor: { session_id: session.providerUploadId, offset },
            commit: { path: filePath, mode: 'add', autorename: true },
          }),
        },
        body: body as unknown as BodyInit,
        signal: context.abortSignal,
      })

      if (!res.ok) {
        throw new AppError({
          code: ErrorCode.CHUNK_FAILED,
          message: `Dropbox upload session finish failed: ${res.status}`,
          statusCode: res.status,
          retryable: res.status >= 500,
        })
      }

      const committedOffset = offset + chunkLength
      return {
        session: { ...session, nextOffset: committedOffset },
        committedOffset,
        completed: true,
      }
    }

    const res = await fetch(`${DBX_CONTENT_API}/files/upload_session/append_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          cursor: { session_id: session.providerUploadId, offset },
          close: false,
        }),
      },
      body: body as unknown as BodyInit,
      signal: context.abortSignal,
    })

    if (!res.ok) {
      throw new AppError({
        code: ErrorCode.CHUNK_FAILED,
        message: `Dropbox upload session append failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    const committedOffset = offset + chunkLength
    return {
      session: { ...session, nextOffset: committedOffset },
      committedOffset,
      completed: false,
    }
  }

  async getResumableUploadStatus(
    request: GetResumableUploadStatusRequest,
  ): Promise<GetResumableUploadStatusResponse> {
    const { context, auth, session } = request

    const res = await fetch(`${DBX_CONTENT_API}/files/upload_session/append_v2`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          cursor: { session_id: session.providerUploadId, offset: session.nextOffset },
          close: false,
        }),
      },
      body: new Uint8Array(0) as unknown as BodyInit,
      signal: context.abortSignal,
    })

    if (!res.ok && res.status !== 400) {
      throw new AppError({
        code: ErrorCode.CHUNK_FAILED,
        message: `Dropbox upload status check failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    return { session }
  }

  async finalizeResumableUpload(
    request: FinalizeResumableUploadRequest,
  ): Promise<FinalizeResumableUploadResponse> {
    const { session } = request

    const file: ProviderFile = {
      id: session.providerUploadId,
      name: session.fileName,
      isFolder: false,
      size: session.contentLength,
      mimeType: session.contentType,
    }

    return { session, file }
  }

  async abortResumableUpload(_request: AbortResumableUploadRequest): Promise<void> {}

  async createShareLink(request: CreateShareLinkRequest): Promise<CreateShareLinkResponse> {
    const { context, auth, fileId, expiresAt } = request

    const settings: Record<string, unknown> = { requested_visibility: { '.tag': 'public' } }
    if (expiresAt) {
      settings['expires'] = expiresAt
    }

    const data = await dbxPost(
      '/sharing/create_shared_link_with_settings',
      auth.accessToken,
      { path: fileId, settings },
      context.abortSignal,
    )

    return {
      link: {
        id: data['id'] as string,
        url: data['url'] as string,
        expiresAt,
      },
    }
  }

  async revokeShareLink(request: RevokeShareLinkRequest): Promise<void> {
    const { context, auth, fileId: _fileId, linkId } = request

    if (!linkId) {
      return
    }

    await dbxPost(
      '/sharing/revoke_shared_link',
      auth.accessToken,
      { url: linkId },
      context.abortSignal,
    )
  }
}
