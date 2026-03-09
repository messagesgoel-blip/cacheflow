import { Readable } from 'stream'
import { AppError } from '../errors/AppError'
import { ErrorCode } from '../errors/ErrorCode'
import * as trash from './googleDrive/trash'
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
  ResumableUploadSession,
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

const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3'
const GOOGLE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'
const GOOGLE_AUTH_API = 'https://oauth2.googleapis.com'

const FILE_FIELDS =
  'id,name,mimeType,size,parents,md5Checksum,createdTime,modifiedTime,webViewLink,trashed,explicitlyTrashed'

export const googleDriveDescriptor: ProviderDescriptor = {
  id: 'google',
  displayName: 'Google Drive',
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

function driveFileToProviderFile(raw: Record<string, unknown>): ProviderFile {
  return {
    id: raw['id'] as string,
    name: raw['name'] as string,
    isFolder: raw['mimeType'] === 'application/vnd.google-apps.folder',
    size: raw['size'] !== undefined ? Number(raw['size']) : 0,
    parentId: Array.isArray(raw['parents']) ? (raw['parents'][0] as string) : undefined,
    mimeType: raw['mimeType'] as string | undefined,
    etag: raw['md5Checksum'] as string | undefined,
    checksum: raw['md5Checksum'] as string | undefined,
    createdAt: raw['createdTime'] as string | undefined,
    modifiedAt: raw['modifiedTime'] as string | undefined,
    webUrl: raw['webViewLink'] as string | undefined,
  }
}

async function driveGet(
  path: string,
  accessToken: string,
  params?: Record<string, string>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const url = new URL(`${GOOGLE_DRIVE_API}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new AppError({
      code:
        res.status === 401
          ? ErrorCode.UNAUTHORIZED
          : res.status === 429
            ? ErrorCode.RATE_LIMITED
            : res.status === 404
              ? ErrorCode.NOT_FOUND
              : ErrorCode.PROVIDER_UNAVAILABLE,
      message: `Google Drive GET ${path} failed: ${res.status} ${body}`,
      statusCode: res.status,
      retryable: res.status === 429 || res.status >= 500,
    })
  }

  return res.json() as Promise<Record<string, unknown>>
}

async function drivePost(
  path: string,
  accessToken: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${GOOGLE_DRIVE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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
      message: `Google Drive POST ${path} failed: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status === 429 || res.status >= 500,
    })
  }

  return res.json() as Promise<Record<string, unknown>>
}

async function drivePatch(
  path: string,
  accessToken: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${GOOGLE_DRIVE_API}${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new AppError({
      code:
        res.status === 401
          ? ErrorCode.UNAUTHORIZED
          : res.status === 404
            ? ErrorCode.NOT_FOUND
            : res.status === 409
              ? ErrorCode.CONFLICT
              : ErrorCode.PROVIDER_UNAVAILABLE,
      message: `Google Drive PATCH ${path} failed: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status >= 500,
    })
  }

  return res.json() as Promise<Record<string, unknown>>
}

async function driveDelete(
  path: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${GOOGLE_DRIVE_API}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  })

  if (!res.ok && res.status !== 204) {
    const text = await res.text()
    throw new AppError({
      code:
        res.status === 401
          ? ErrorCode.UNAUTHORIZED
          : res.status === 404
            ? ErrorCode.NOT_FOUND
            : ErrorCode.PROVIDER_UNAVAILABLE,
      message: `Google Drive DELETE ${path} failed: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status >= 500,
    })
  }
}

async function collectStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
  }
  return Buffer.concat(chunks)
}

export class GoogleDriveAdapter implements ProviderAdapter {
  readonly descriptor: ProviderDescriptor = googleDriveDescriptor

  async connect(request: ConnectRequest): Promise<ConnectResponse> {
    const { context, code } = request

    if (!code) {
      throw new AppError({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'OAuth authorization code is required',
      })
    }

    const clientId = process.env['GOOGLE_CLIENT_ID']
    const clientSecret = process.env['GOOGLE_CLIENT_SECRET']
    const redirectUri = process.env['GOOGLE_REDIRECT_URI']

    if (!clientId || !clientSecret || !redirectUri) {
      throw new AppError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Google OAuth environment variables not configured',
      })
    }

    const tokenRes = await fetch(`${GOOGLE_AUTH_API}/token`, {
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
        message: 'Google OAuth token exchange failed',
        statusCode: tokenRes.status,
      })
    }

    const tokens = (await tokenRes.json()) as Record<string, unknown>

    const profile = await driveGet(
      '/about',
      tokens['access_token'] as string,
      { fields: 'user(emailAddress,displayName,photoLink)' },
      context.abortSignal,
    )

    const user = profile['user'] as Record<string, string>

    return {
      account: {
        accountId: user['emailAddress'],
        email: user['emailAddress'],
        displayName: user['displayName'],
        avatarUrl: user['photoLink'],
      },
      auth: {
        accountId: user['emailAddress'],
        accessToken: tokens['access_token'] as string,
        refreshToken: tokens['refresh_token'] as string | undefined,
        expiresAt:
          tokens['expires_in'] !== undefined
            ? new Date(Date.now() + Number(tokens['expires_in']) * 1000).toISOString()
            : undefined,
        scopes: typeof tokens['scope'] === 'string' ? tokens['scope'].split(' ') : undefined,
      },
    }
  }

  async refreshAuth(request: RefreshAuthRequest): Promise<RefreshAuthResponse> {
    const { context, auth } = request

    if (!auth.refreshToken) {
      throw new AppError({ code: ErrorCode.REFRESH_FAILED, message: 'No refresh token available' })
    }

    const clientId = process.env['GOOGLE_CLIENT_ID']
    const clientSecret = process.env['GOOGLE_CLIENT_SECRET']

    if (!clientId || !clientSecret) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'Google OAuth env vars missing' })
    }

    const res = await fetch(`${GOOGLE_AUTH_API}/token`, {
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
        message: 'Google token refresh failed',
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

  async disconnect(_request: DisconnectRequest): Promise<void> {}

  async validateAuth(request: ValidateAuthRequest): Promise<ValidateAuthResponse> {
    const { context, auth } = request

    try {
      await driveGet('/about', auth.accessToken, { fields: 'user(emailAddress)' }, context.abortSignal)
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

    const data = await driveGet(
      '/about',
      auth.accessToken,
      { fields: 'storageQuota(usage,limit)' },
      context.abortSignal,
    )

    const quota = data['storageQuota'] as Record<string, string>
    const total = Number(quota['limit'] ?? 0)
    const used = Number(quota['usage'] ?? 0)

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

    const parentQuery = folderId ? `'${folderId}' in parents` : "'root' in parents"
    const params: Record<string, string> = {
      q: `${parentQuery} and trashed = false`,
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: String(pageSize),
      orderBy: 'folder,name',
    }

    if (cursor) {
      params['pageToken'] = cursor
    }

    const data = await driveGet('/files', auth.accessToken, params, context.abortSignal)
    const rawFiles = (data['files'] as Record<string, unknown>[]) ?? []

    return {
      files: rawFiles.map(driveFileToProviderFile),
      nextCursor: data['nextPageToken'] as string | undefined,
      hasMore: Boolean(data['nextPageToken']),
    }
  }

  async searchFiles(request: SearchFilesRequest): Promise<SearchFilesResponse> {
    const { context, auth, query, cursor, pageSize = 50 } = request

    const params: Record<string, string> = {
      q: `fullText contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: String(pageSize),
    }

    if (cursor) {
      params['pageToken'] = cursor
    }

    const data = await driveGet('/files', auth.accessToken, params, context.abortSignal)
    const rawFiles = (data['files'] as Record<string, unknown>[]) ?? []

    return {
      files: rawFiles.map(driveFileToProviderFile),
      nextCursor: data['nextPageToken'] as string | undefined,
      hasMore: Boolean(data['nextPageToken']),
    }
  }

  async getFile(request: GetFileRequest): Promise<GetFileResponse> {
    const { context, auth, fileId } = request

    const data = await driveGet(
      `/files/${fileId}`,
      auth.accessToken,
      { fields: FILE_FIELDS },
      context.abortSignal,
    )

    return { file: driveFileToProviderFile(data) }
  }

  async createFolder(request: CreateFolderRequest): Promise<CreateFolderResponse> {
    const { context, auth, name, parentId } = request

    const body: Record<string, unknown> = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    }

    if (parentId) {
      body['parents'] = [parentId]
    }

    const data = await drivePost('/files', auth.accessToken, body, context.abortSignal)

    return { folder: driveFileToProviderFile(data) }
  }

  async moveFile(request: MoveFileRequest): Promise<MoveFileResponse> {
    const { context, auth, fileId, newParentId, newName } = request

    const current = await driveGet(
      `/files/${fileId}`,
      auth.accessToken,
      { fields: 'parents' },
      context.abortSignal,
    )

    const currentParents = ((current['parents'] as string[]) ?? []).join(',')

    const url = new URL(`${GOOGLE_DRIVE_API}/files/${fileId}`)
    url.searchParams.set('addParents', newParentId)
    url.searchParams.set('removeParents', currentParents)
    url.searchParams.set('fields', FILE_FIELDS)

    const patchBody = newName ? { name: newName } : {}

    const res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patchBody),
      signal: context.abortSignal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new AppError({
        code: ErrorCode.TRANSFER_FAILED,
        message: `Google Drive move failed: ${res.status} ${text}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    const data = (await res.json()) as Record<string, unknown>
    return { file: driveFileToProviderFile(data) }
  }

  async copyFile(request: CopyFileRequest): Promise<CopyFileResponse> {
    const { context, auth, fileId, newParentId, newName } = request

    const body: Record<string, unknown> = { parents: [newParentId] }
    if (newName) {
      body['name'] = newName
    }

    const data = await drivePost(`/files/${fileId}/copy`, auth.accessToken, body, context.abortSignal)

    return { file: driveFileToProviderFile(data) }
  }

  async renameFile(request: RenameFileRequest): Promise<RenameFileResponse> {
    const { context, auth, fileId, newName } = request

    const data = await drivePatch(
      `/files/${fileId}?fields=${FILE_FIELDS}`,
      auth.accessToken,
      { name: newName },
      context.abortSignal,
    )

    return { file: driveFileToProviderFile(data) }
  }

  async deleteFile(request: DeleteFileRequest): Promise<void> {
    const { context, auth, fileId, permanent } = request
    if (permanent) {
      await driveDelete(`/files/${fileId}`, auth.accessToken, context.abortSignal)
    } else {
      await drivePatch(`/files/${fileId}`, auth.accessToken, { trashed: true }, context.abortSignal)
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

    const fileMeta = await this.getFile({ context, auth, fileId })

    const headers: Record<string, string> = { Authorization: `Bearer ${auth.accessToken}` }

    if (range) {
      const end = range.end !== undefined ? range.end : ''
      headers['Range'] = `bytes=${range.start}-${end}`
    }

    const res = await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}?alt=media`, {
      headers,
      signal: context.abortSignal,
    })

    if (!res.ok) {
      throw new AppError({
        code: ErrorCode.PROVIDER_UNAVAILABLE,
        message: `Google Drive download failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    if (!res.body) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'Google Drive response has no body' })
    }

    const stream = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
    const contentLength = res.headers.get('content-length')

    return {
      file: fileMeta.file,
      stream,
      contentLength: contentLength ? Number(contentLength) : undefined,
    }
  }

  async uploadStream(request: UploadStreamRequest): Promise<UploadStreamResponse> {
    const { context, auth, parentId, fileName, contentType, contentLength, stream } = request

    const metadata: Record<string, unknown> = { name: fileName }
    if (parentId) {
      metadata['parents'] = [parentId]
    }

    const mimeType = contentType ?? 'application/octet-stream'

    const initRes = await fetch(`${GOOGLE_UPLOAD_API}/files?uploadType=resumable`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': mimeType,
        ...(contentLength !== undefined ? { 'X-Upload-Content-Length': String(contentLength) } : {}),
      },
      body: JSON.stringify(metadata),
      signal: context.abortSignal,
    })

    if (!initRes.ok) {
      throw new AppError({
        code: ErrorCode.PROVIDER_UNAVAILABLE,
        message: `Google Drive upload init failed: ${initRes.status}`,
        statusCode: initRes.status,
        retryable: initRes.status >= 500,
      })
    }

    const uploadUrl = initRes.headers.get('location')
    if (!uploadUrl) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'Google Drive upload URL missing' })
    }

    const body = await collectStream(stream)

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(body.length),
      },
      body: body as unknown as BodyInit,
      signal: context.abortSignal,
    })

    if (!uploadRes.ok) {
      throw new AppError({
        code: ErrorCode.TRANSFER_FAILED,
        message: `Google Drive upload failed: ${uploadRes.status}`,
        statusCode: uploadRes.status,
        retryable: uploadRes.status >= 500,
      })
    }

    const data = (await uploadRes.json()) as Record<string, unknown>
    return { file: driveFileToProviderFile(data) }
  }

  async createResumableUpload(
    request: CreateResumableUploadRequest,
  ): Promise<CreateResumableUploadResponse> {
    const { context, auth, parentId, fileName, contentType, contentLength, chunkSize } = request

    const metadata: Record<string, unknown> = { name: fileName }
    if (parentId) {
      metadata['parents'] = [parentId]
    }

    const mimeType = contentType ?? 'application/octet-stream'

    const initRes = await fetch(`${GOOGLE_UPLOAD_API}/files?uploadType=resumable`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(contentLength),
      },
      body: JSON.stringify(metadata),
      signal: context.abortSignal,
    })

    if (!initRes.ok) {
      throw new AppError({
        code: ErrorCode.PROVIDER_UNAVAILABLE,
        message: `Google Drive resumable upload init failed: ${initRes.status}`,
        statusCode: initRes.status,
        retryable: initRes.status >= 500,
      })
    }

    const uploadUrl = initRes.headers.get('location')
    if (!uploadUrl) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'Google Drive upload URL missing' })
    }

    return {
      session: {
        sessionId: `google-${context.requestId}`,
        providerUploadId: uploadUrl,
        parentId,
        fileName,
        contentType: mimeType,
        contentLength,
        chunkSize,
        nextOffset: 0,
      },
    }
  }

  async uploadResumableChunk(request: UploadResumableChunkRequest): Promise<UploadResumableChunkResponse> {
    const { context, auth: _auth, session, offset, chunkLength, payload, isFinalChunk } = request

    const rangeEnd = offset + chunkLength - 1
    const totalSize = isFinalChunk ? offset + chunkLength : '*'

    let body: Buffer
    if (Buffer.isBuffer(payload)) {
      body = payload
    } else if (payload instanceof Uint8Array) {
      body = Buffer.from(payload)
    } else {
      body = await collectStream(payload as Readable)
    }

    const res = await fetch(session.providerUploadId, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${offset}-${rangeEnd}/${totalSize}`,
        'Content-Length': String(chunkLength),
      },
      body: body as unknown as BodyInit,
      signal: context.abortSignal,
    })

    const completed = res.status === 200 || res.status === 201

    if (!completed && res.status !== 308) {
      throw new AppError({
        code: ErrorCode.CHUNK_FAILED,
        message: `Google Drive chunk upload failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    const rangeHeader = res.headers.get('range')
    const committedOffset = rangeHeader
      ? Number(rangeHeader.split('-')[1]) + 1
      : offset + chunkLength

    return {
      session: { ...session, nextOffset: committedOffset },
      committedOffset,
      completed,
    }
  }

  async getResumableUploadStatus(
    request: GetResumableUploadStatusRequest,
  ): Promise<GetResumableUploadStatusResponse> {
    const { context, auth: _auth, session } = request

    const res = await fetch(session.providerUploadId, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes */${session.contentLength}`,
        'Content-Length': '0',
      },
      signal: context.abortSignal,
    })

    if (res.status === 308) {
      const rangeHeader = res.headers.get('range')
      const nextOffset = rangeHeader ? Number(rangeHeader.split('-')[1]) + 1 : 0

      return { session: { ...session, nextOffset } }
    }

    if (res.status === 200 || res.status === 201) {
      return { session: { ...session, nextOffset: session.contentLength } }
    }

    throw new AppError({
      code: ErrorCode.CHUNK_FAILED,
      message: `Google Drive upload status check failed: ${res.status}`,
      statusCode: res.status,
      retryable: false,
    })
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

    await drivePost(
      `/files/${fileId}/permissions`,
      auth.accessToken,
      { role: 'reader', type: 'anyone' },
      context.abortSignal,
    )

    const data = await driveGet(
      `/files/${fileId}`,
      auth.accessToken,
      { fields: 'id,webViewLink' },
      context.abortSignal,
    )

    return {
      link: {
        id: data['id'] as string,
        url: data['webViewLink'] as string,
        expiresAt,
      },
    }
  }

  async revokeShareLink(request: RevokeShareLinkRequest): Promise<void> {
    const { context, auth, fileId } = request

    const permsData = await driveGet(
      `/files/${fileId}/permissions`,
      auth.accessToken,
      { fields: 'permissions(id,type)' },
      context.abortSignal,
    )

    const permissions = (permsData['permissions'] as Array<Record<string, string>>) ?? []
    const anyonePerm = permissions.find((p) => p['type'] === 'anyone')

    if (anyonePerm) {
      await driveDelete(
        `/files/${fileId}/permissions/${anyonePerm['id']}`,
        auth.accessToken,
        context.abortSignal,
      )
    }
  }
}
