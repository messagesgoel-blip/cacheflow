import { Readable } from 'stream'
import { AppError } from '../errors/AppError'
import { ErrorCode } from '../errors/ErrorCode'
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
  ProviderFile,
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

const GRAPH_API = 'https://graph.microsoft.com/v1.0'
const MS_AUTH_API = 'https://login.microsoftonline.com'

export const oneDriveDescriptor: ProviderDescriptor = {
  id: 'onedrive',
  displayName: 'OneDrive',
  authType: 'oauth2',
  capabilities: {
    supportsAuthRefresh: true,
    supportsSearch: true,
    supportsShareLinks: true,
    supportsResumableUpload: true,
    supportsChunkResume: true,
    supportsStreamingTransfer: true,
    supportsServerSideCopy: true,
  },
}

function driveItemToProviderFile(raw: Record<string, unknown>): ProviderFile {
  const folder = raw['folder']
  const file = raw['file'] as Record<string, unknown> | undefined
  const hashes = file?.['hashes'] as Record<string, string> | undefined

  return {
    id: raw['id'] as string,
    name: raw['name'] as string,
    isFolder: folder !== undefined,
    size: raw['size'] !== undefined ? Number(raw['size']) : 0,
    parentId: (raw['parentReference'] as Record<string, string> | undefined)?.['id'],
    mimeType: file?.['mimeType'] as string | undefined,
    etag: raw['eTag'] as string | undefined,
    checksum: hashes?.['sha256Hash'] ?? hashes?.['quickXorHash'],
    createdAt: (raw['createdDateTime'] as string) ?? undefined,
    modifiedAt: (raw['lastModifiedDateTime'] as string) ?? undefined,
    webUrl: raw['webUrl'] as string | undefined,
  }
}

async function graphRequest(
  method: string,
  path: string,
  accessToken: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    ...extraHeaders,
  }

  if (body !== undefined && !extraHeaders?.['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${GRAPH_API}${path}`, {
    method,
    headers,
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
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
            : res.status === 404
              ? ErrorCode.NOT_FOUND
              : res.status === 409
                ? ErrorCode.CONFLICT
                : ErrorCode.PROVIDER_UNAVAILABLE,
      message: `OneDrive ${method} ${path} failed: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status === 429 || res.status >= 500,
    })
  }

  if (res.status === 204) {
    return {}
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

export class OneDriveAdapter implements ProviderAdapter {
  readonly descriptor: ProviderDescriptor = oneDriveDescriptor

  async connect(request: ConnectRequest): Promise<ConnectResponse> {
    const { context, code } = request

    if (!code) {
      throw new AppError({ code: ErrorCode.VALIDATION_FAILED, message: 'OAuth code required' })
    }

    const clientId = process.env['ONEDRIVE_CLIENT_ID']
    const clientSecret = process.env['ONEDRIVE_CLIENT_SECRET']
    const redirectUri = process.env['ONEDRIVE_REDIRECT_URI']
    const tenant = process.env['ONEDRIVE_TENANT'] ?? 'common'

    if (!clientId || !clientSecret || !redirectUri) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'OneDrive OAuth env vars missing' })
    }

    const tokenRes = await fetch(`${MS_AUTH_API}/${tenant}/oauth2/v2.0/token`, {
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
        message: 'OneDrive OAuth token exchange failed',
        statusCode: tokenRes.status,
      })
    }

    const tokens = (await tokenRes.json()) as Record<string, unknown>
    const accessToken = tokens['access_token'] as string

    const profile = await graphRequest('GET', '/me', accessToken, undefined, undefined, context.abortSignal)

    const accountId = profile['id'] as string

    return {
      account: {
        accountId,
        email: profile['mail'] as string | undefined,
        displayName: profile['displayName'] as string | undefined,
      },
      auth: {
        accountId,
        accessToken,
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

    const clientId = process.env['ONEDRIVE_CLIENT_ID']
    const clientSecret = process.env['ONEDRIVE_CLIENT_SECRET']
    const tenant = process.env['ONEDRIVE_TENANT'] ?? 'common'

    if (!clientId || !clientSecret) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'OneDrive OAuth env vars missing' })
    }

    const res = await fetch(`${MS_AUTH_API}/${tenant}/oauth2/v2.0/token`, {
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
        message: 'OneDrive token refresh failed',
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
      await graphRequest('GET', '/me', auth.accessToken, undefined, undefined, context.abortSignal)
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

    const data = await graphRequest(
      'GET',
      '/me/drive?$select=quota',
      auth.accessToken,
      undefined,
      undefined,
      context.abortSignal,
    )

    const quota = data['quota'] as Record<string, number>

    return {
      quota: {
        usedBytes: quota['used'] ?? 0,
        totalBytes: quota['total'] ?? 0,
        freeBytes: quota['remaining'] ?? 0,
      },
    }
  }

  async listFiles(request: ListFilesRequest): Promise<ListFilesResponse> {
    const { context, auth, folderId, cursor, pageSize = 100 } = request

    let path: string
    if (cursor) {
      path = cursor
    } else {
      const parent = folderId ? `/me/drive/items/${folderId}` : '/me/drive/root'
      path = `${parent}/children?$top=${pageSize}&$select=id,name,size,file,folder,parentReference,eTag,createdDateTime,lastModifiedDateTime,webUrl`
    }

    const data = await graphRequest('GET', path, auth.accessToken, undefined, undefined, context.abortSignal)

    const rawItems = (data['value'] as Record<string, unknown>[]) ?? []
    const nextLink = data['@odata.nextLink'] as string | undefined

    return {
      files: rawItems.map(driveItemToProviderFile),
      nextCursor: nextLink ? new URL(nextLink).pathname + new URL(nextLink).search : undefined,
      hasMore: Boolean(nextLink),
    }
  }

  async searchFiles(request: SearchFilesRequest): Promise<SearchFilesResponse> {
    const { context, auth, query, cursor, pageSize = 50 } = request

    const path = cursor
      ? cursor
      : `/me/drive/root/search(q='${encodeURIComponent(query)}')?$top=${pageSize}`

    const data = await graphRequest('GET', path, auth.accessToken, undefined, undefined, context.abortSignal)

    const rawItems = (data['value'] as Record<string, unknown>[]) ?? []
    const nextLink = data['@odata.nextLink'] as string | undefined

    return {
      files: rawItems.map(driveItemToProviderFile),
      nextCursor: nextLink ? new URL(nextLink).pathname + new URL(nextLink).search : undefined,
      hasMore: Boolean(nextLink),
    }
  }

  async getFile(request: GetFileRequest): Promise<GetFileResponse> {
    const { context, auth, fileId } = request

    const data = await graphRequest(
      'GET',
      `/me/drive/items/${fileId}`,
      auth.accessToken,
      undefined,
      undefined,
      context.abortSignal,
    )

    return { file: driveItemToProviderFile(data) }
  }

  async createFolder(request: CreateFolderRequest): Promise<CreateFolderResponse> {
    const { context, auth, name, parentId } = request

    const parent = parentId ? `/me/drive/items/${parentId}` : '/me/drive/root'

    const data = await graphRequest(
      'POST',
      `${parent}/children`,
      auth.accessToken,
      { name, folder: {}, '@microsoft.graph.conflictBehavior': 'rename' },
      undefined,
      context.abortSignal,
    )

    return { folder: driveItemToProviderFile(data) }
  }

  async moveFile(request: MoveFileRequest): Promise<MoveFileResponse> {
    const { context, auth, fileId, newParentId, newName } = request

    const body: Record<string, unknown> = {
      parentReference: { id: newParentId },
    }
    if (newName) {
      body['name'] = newName
    }

    const data = await graphRequest(
      'PATCH',
      `/me/drive/items/${fileId}`,
      auth.accessToken,
      body,
      undefined,
      context.abortSignal,
    )

    return { file: driveItemToProviderFile(data) }
  }

  async copyFile(request: CopyFileRequest): Promise<CopyFileResponse> {
    const { context, auth, fileId, newParentId, newName } = request

    const body: Record<string, unknown> = {
      parentReference: { id: newParentId },
    }
    if (newName) {
      body['name'] = newName
    }

    await graphRequest(
      'POST',
      `/me/drive/items/${fileId}/copy`,
      auth.accessToken,
      body,
      undefined,
      context.abortSignal,
    )

    const data = await graphRequest(
      'GET',
      `/me/drive/items/${fileId}`,
      auth.accessToken,
      undefined,
      undefined,
      context.abortSignal,
    )

    return { file: driveItemToProviderFile(data) }
  }

  async renameFile(request: RenameFileRequest): Promise<RenameFileResponse> {
    const { context, auth, fileId, newName } = request

    const data = await graphRequest(
      'PATCH',
      `/me/drive/items/${fileId}`,
      auth.accessToken,
      { name: newName },
      undefined,
      context.abortSignal,
    )

    return { file: driveItemToProviderFile(data) }
  }

  async deleteFile(request: DeleteFileRequest): Promise<void> {
    const { context, auth, fileId } = request
    await graphRequest('DELETE', `/me/drive/items/${fileId}`, auth.accessToken, undefined, undefined, context.abortSignal)
  }

  async downloadStream(request: DownloadStreamRequest): Promise<DownloadStreamResponse> {
    const { context, auth, fileId, range } = request

    const fileMeta = await this.getFile({ context, auth, fileId })

    const headers: Record<string, string> = { Authorization: `Bearer ${auth.accessToken}` }
    if (range) {
      const end = range.end !== undefined ? range.end : ''
      headers['Range'] = `bytes=${range.start}-${end}`
    }

    const contentRes = await graphRequest(
      'GET',
      `/me/drive/items/${fileId}?$select=@microsoft.graph.downloadUrl`,
      auth.accessToken,
      undefined,
      undefined,
      context.abortSignal,
    )

    const downloadUrl = contentRes['@microsoft.graph.downloadUrl'] as string
    if (!downloadUrl) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'OneDrive download URL missing' })
    }

    const res = await fetch(downloadUrl, { headers, signal: context.abortSignal })

    if (!res.ok) {
      throw new AppError({
        code: ErrorCode.PROVIDER_UNAVAILABLE,
        message: `OneDrive download failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    if (!res.body) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'OneDrive response has no body' })
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
    const { context, auth, parentId, fileName, contentLength, contentType, stream } = request

    const parent = parentId ? `/me/drive/items/${parentId}` : '/me/drive/root'
    const body = await collectStream(stream)

    const res = await fetch(`${GRAPH_API}${parent}:/${encodeURIComponent(fileName)}:/content`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': contentType ?? 'application/octet-stream',
        ...(contentLength !== undefined ? { 'Content-Length': String(contentLength) } : {}),
      },
      body: body as unknown as BodyInit,
      signal: context.abortSignal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new AppError({
        code: ErrorCode.TRANSFER_FAILED,
        message: `OneDrive upload failed: ${res.status} ${text}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    const data = (await res.json()) as Record<string, unknown>
    return { file: driveItemToProviderFile(data) }
  }

  async createResumableUpload(
    request: CreateResumableUploadRequest,
  ): Promise<CreateResumableUploadResponse> {
    const { context, auth, parentId, fileName, contentType, contentLength, chunkSize } = request

    const parent = parentId ? `/me/drive/items/${parentId}` : '/me/drive/root'
    const mimeType = contentType ?? 'application/octet-stream'

    const sessionRes = await graphRequest(
      'POST',
      `${parent}:/${encodeURIComponent(fileName)}:/createUploadSession`,
      auth.accessToken,
      { item: { '@microsoft.graph.conflictBehavior': 'rename', name: fileName } },
      undefined,
      context.abortSignal,
    )

    const uploadUrl = sessionRes['uploadUrl'] as string
    if (!uploadUrl) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'OneDrive upload session URL missing' })
    }

    return {
      session: {
        sessionId: `onedrive-${context.requestId}`,
        providerUploadId: uploadUrl,
        parentId,
        fileName,
        contentType: mimeType,
        contentLength,
        chunkSize,
        nextOffset: 0,
        expiresAt: sessionRes['expirationDateTime'] as string | undefined,
      },
    }
  }

  async uploadResumableChunk(request: UploadResumableChunkRequest): Promise<UploadResumableChunkResponse> {
    const { context, auth: _auth, session, offset, chunkLength, payload, isFinalChunk: _isFinalChunk } = request

    let body: Buffer
    if (Buffer.isBuffer(payload)) {
      body = payload
    } else if (payload instanceof Uint8Array) {
      body = Buffer.from(payload)
    } else {
      body = await collectStream(payload as Readable)
    }

    const rangeEnd = offset + chunkLength - 1

    const res = await fetch(session.providerUploadId, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${offset}-${rangeEnd}/${session.contentLength}`,
        'Content-Length': String(chunkLength),
      },
      body: body as unknown as BodyInit,
      signal: context.abortSignal,
    })

    const completed = res.status === 200 || res.status === 201

    if (!completed && res.status !== 202) {
      throw new AppError({
        code: ErrorCode.CHUNK_FAILED,
        message: `OneDrive chunk upload failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    const committedOffset = offset + chunkLength

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
      method: 'GET',
      signal: context.abortSignal,
    })

    if (!res.ok) {
      throw new AppError({
        code: ErrorCode.CHUNK_FAILED,
        message: `OneDrive upload status check failed: ${res.status}`,
        statusCode: res.status,
        retryable: false,
      })
    }

    const data = (await res.json()) as Record<string, unknown>
    const nextExpected = data['nextExpectedRanges'] as string[] | undefined
    const nextOffset = nextExpected?.[0] ? Number(nextExpected[0].split('-')[0]) : session.nextOffset

    return { session: { ...session, nextOffset } }
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

  async abortResumableUpload(request: AbortResumableUploadRequest): Promise<void> {
    const { context, auth: _auth, session } = request

    await fetch(session.providerUploadId, {
      method: 'DELETE',
      signal: context.abortSignal,
    })
  }

  async createShareLink(request: CreateShareLinkRequest): Promise<CreateShareLinkResponse> {
    const { context, auth, fileId, expiresAt } = request

    const body: Record<string, unknown> = { type: 'view', scope: 'anonymous' }
    if (expiresAt) {
      body['expirationDateTime'] = expiresAt
    }

    const data = await graphRequest(
      'POST',
      `/me/drive/items/${fileId}/createLink`,
      auth.accessToken,
      body,
      undefined,
      context.abortSignal,
    )

    const link = data['link'] as Record<string, string>

    return {
      link: {
        id: data['id'] as string,
        url: link['webUrl'],
        expiresAt,
      },
    }
  }

  async revokeShareLink(request: RevokeShareLinkRequest): Promise<void> {
    const { context, auth, fileId, linkId } = request

    if (!linkId) {
      return
    }

    await graphRequest(
      'DELETE',
      `/me/drive/items/${fileId}/permissions/${linkId}`,
      auth.accessToken,
      undefined,
      undefined,
      context.abortSignal,
    )
  }
}

