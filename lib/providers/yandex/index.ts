import { Readable } from 'stream'
import { AppError } from '../../errors/AppError'
import { ErrorCode } from '../../errors/ErrorCode'
import type { ProviderAdapter } from '../ProviderAdapter.interface'
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
} from '../types'

const YADISK_API = 'https://cloud-api.yandex.net/v1/disk'
const YADISK_OAUTH_API = 'https://oauth.yandex.com'

export const yandexDescriptor: ProviderDescriptor = {
  id: 'yandex',
  displayName: 'Yandex Disk',
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

function yadiskResourceToProviderFile(raw: Record<string, unknown>): ProviderFile {
  const type = raw['type'] as string

  return {
    id: (raw['resource_id'] as string | undefined) ?? (raw['path'] as string),
    name: raw['name'] as string,
    isFolder: type === 'dir',
    size: raw['size'] !== undefined ? Number(raw['size']) : 0,
    path: raw['path'] as string | undefined,
    mimeType: raw['mime_type'] as string | undefined,
    etag: raw['revision'] !== undefined ? String(raw['revision']) : undefined,
    checksum: raw['md5'] as string | undefined,
    createdAt: raw['created'] as string | undefined,
    modifiedAt: raw['modified'] as string | undefined,
    webUrl: raw['public_url'] as string | undefined,
  }
}

function mapYadiskStatus(status: number): ErrorCode {
  if (status === 401) return ErrorCode.UNAUTHORIZED
  if (status === 403) return ErrorCode.FORBIDDEN
  if (status === 404) return ErrorCode.NOT_FOUND
  if (status === 409) return ErrorCode.CONFLICT
  if (status === 429) return ErrorCode.RATE_LIMITED
  if (status === 507) return ErrorCode.QUOTA_EXCEEDED
  return ErrorCode.PROVIDER_UNAVAILABLE
}

async function yadiskRequest(
  method: string,
  path: string,
  accessToken: string,
  params?: Record<string, string>,
  body?: unknown,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const url = new URL(`${YADISK_API}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }

  const headers: Record<string, string> = {
    Authorization: `OAuth ${accessToken}`,
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new AppError({
      code: mapYadiskStatus(res.status),
      message: `Yandex Disk ${method} ${path} failed: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status === 429 || res.status >= 500,
    })
  }

  if (res.status === 204 || res.status === 201) {
    const location = res.headers.get('location')
    return location ? { href: location } : {}
  }

  return res.json() as Promise<Record<string, unknown>>
}

async function yadiskAwaitOperation(
  href: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(href, {
      headers: { Authorization: `OAuth ${accessToken}` },
      signal,
    })

    if (!res.ok) break

    const data = (await res.json()) as Record<string, unknown>
    const status = data['status'] as string

    if (status === 'success') return
    if (status === 'failed') {
      throw new AppError({
        code: ErrorCode.TRANSFER_FAILED,
        message: 'Yandex Disk async operation failed',
      })
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 1000))
  }
}

async function collectStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
  }
  return Buffer.concat(chunks)
}

export class YandexAdapter implements ProviderAdapter {
  readonly descriptor: ProviderDescriptor = yandexDescriptor

  async connect(request: ConnectRequest): Promise<ConnectResponse> {
    const { context, code } = request

    if (!code) {
      throw new AppError({ code: ErrorCode.VALIDATION_FAILED, message: 'OAuth code required' })
    }

    const clientId = process.env['YANDEX_CLIENT_ID']
    const clientSecret = process.env['YANDEX_CLIENT_SECRET']

    if (!clientId || !clientSecret) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'Yandex OAuth env vars missing' })
    }

    const tokenRes = await fetch(`${YADISK_OAUTH_API}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      signal: context.abortSignal,
    })

    if (!tokenRes.ok) {
      throw new AppError({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Yandex OAuth token exchange failed',
        statusCode: tokenRes.status,
      })
    }

    const tokens = (await tokenRes.json()) as Record<string, unknown>
    const accessToken = tokens['access_token'] as string

    const profileRes = await fetch('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${accessToken}` },
      signal: context.abortSignal,
    })

    if (!profileRes.ok) {
      throw new AppError({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Yandex profile fetch failed',
        statusCode: profileRes.status,
      })
    }

    const profile = (await profileRes.json()) as Record<string, unknown>
    const accountId = String(profile['id'])

    return {
      account: {
        accountId,
        email: (profile['default_email'] ?? (profile['emails'] as string[] | undefined)?.[0]) as string | undefined,
        displayName: profile['real_name'] as string | undefined,
        avatarUrl: profile['default_avatar_id']
          ? `https://avatars.yandex.net/get-yapic/${profile['default_avatar_id']}/islands-75`
          : undefined,
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

    const clientId = process.env['YANDEX_CLIENT_ID']
    const clientSecret = process.env['YANDEX_CLIENT_SECRET']

    if (!clientId || !clientSecret) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'Yandex OAuth env vars missing' })
    }

    const res = await fetch(`${YADISK_OAUTH_API}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: auth.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      signal: context.abortSignal,
    })

    if (!res.ok) {
      throw new AppError({
        code: ErrorCode.REFRESH_FAILED,
        message: 'Yandex token refresh failed',
        statusCode: res.status,
      })
    }

    const tokens = (await res.json()) as Record<string, unknown>

    return {
      refreshedAt: new Date().toISOString(),
      auth: {
        ...auth,
        accessToken: tokens['access_token'] as string,
        refreshToken: (tokens['refresh_token'] as string | undefined) ?? auth.refreshToken,
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
      await yadiskRequest('GET', '', auth.accessToken, undefined, undefined, context.abortSignal)
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

    const data = await yadiskRequest('GET', '', auth.accessToken, undefined, undefined, context.abortSignal)

    const total = Number(data['total_space'] ?? 0)
    const used = Number(data['used_space'] ?? 0)

    return {
      quota: {
        usedBytes: used,
        totalBytes: total,
        freeBytes: Math.max(0, total - used),
      },
    }
  }

  async listFiles(request: ListFilesRequest): Promise<ListFilesResponse> {
    const { context, auth, folderId = 'disk:/', cursor, pageSize = 100 } = request

    const params: Record<string, string> = {
      path: folderId,
      limit: String(pageSize),
      fields: '_embedded',
    }

    if (cursor) {
      params['offset'] = cursor
    }

    const data = await yadiskRequest('GET', '/resources', auth.accessToken, params, undefined, context.abortSignal)

    const embedded = data['_embedded'] as Record<string, unknown> | undefined
    const items = (embedded?.['items'] as Record<string, unknown>[]) ?? []
    const total = Number(embedded?.['total'] ?? 0)
    const offset = Number(embedded?.['offset'] ?? 0)

    const hasMore = offset + pageSize < total
    const nextOffset = offset + pageSize

    return {
      files: items.map(yadiskResourceToProviderFile),
      nextCursor: hasMore ? String(nextOffset) : undefined,
      hasMore,
    }
  }

  async searchFiles(request: SearchFilesRequest): Promise<SearchFilesResponse> {
    const { context, auth, query, cursor, pageSize = 50 } = request

    const params: Record<string, string> = {
      q: query,
      limit: String(pageSize),
    }

    if (cursor) {
      params['offset'] = cursor
    }

    const data = await yadiskRequest('GET', '/resources/search', auth.accessToken, params, undefined, context.abortSignal)

    const items = (data['items'] as Record<string, unknown>[]) ?? []
    const total = Number(data['total'] ?? items.length)
    const offset = Number(data['offset'] ?? 0)

    const hasMore = offset + pageSize < total
    const nextOffset = offset + pageSize

    return {
      files: items.map(yadiskResourceToProviderFile),
      nextCursor: hasMore ? String(nextOffset) : undefined,
      hasMore,
    }
  }

  async getFile(request: GetFileRequest): Promise<GetFileResponse> {
    const { context, auth, fileId } = request

    const data = await yadiskRequest(
      'GET',
      '/resources',
      auth.accessToken,
      { path: fileId },
      undefined,
      context.abortSignal,
    )

    return { file: yadiskResourceToProviderFile(data) }
  }

  async createFolder(request: CreateFolderRequest): Promise<CreateFolderResponse> {
    const { context, auth, name, parentId = 'disk:/' } = request

    const folderPath = parentId.endsWith('/') ? `${parentId}${name}` : `${parentId}/${name}`

    await yadiskRequest(
      'PUT',
      '/resources',
      auth.accessToken,
      { path: folderPath },
      undefined,
      context.abortSignal,
    )

    const data = await yadiskRequest(
      'GET',
      '/resources',
      auth.accessToken,
      { path: folderPath },
      undefined,
      context.abortSignal,
    )

    return { folder: yadiskResourceToProviderFile(data) }
  }

  async moveFile(request: MoveFileRequest): Promise<MoveFileResponse> {
    const { context, auth, fileId, newParentId, newName } = request

    const srcName = fileId.split('/').pop() ?? fileId
    const destName = newName ?? srcName
    const toPath = newParentId.endsWith('/') ? `${newParentId}${destName}` : `${newParentId}/${destName}`

    const result = await yadiskRequest(
      'POST',
      '/resources/move',
      auth.accessToken,
      { from: fileId, path: toPath, overwrite: 'false' },
      undefined,
      context.abortSignal,
    )

    if (result['href']) {
      await yadiskAwaitOperation(result['href'] as string, auth.accessToken, context.abortSignal)
    }

    const data = await yadiskRequest('GET', '/resources', auth.accessToken, { path: toPath }, undefined, context.abortSignal)

    return { file: yadiskResourceToProviderFile(data) }
  }

  async copyFile(request: CopyFileRequest): Promise<CopyFileResponse> {
    const { context, auth, fileId, newParentId, newName } = request

    const srcName = fileId.split('/').pop() ?? fileId
    const destName = newName ?? srcName
    const toPath = newParentId.endsWith('/') ? `${newParentId}${destName}` : `${newParentId}/${destName}`

    const result = await yadiskRequest(
      'POST',
      '/resources/copy',
      auth.accessToken,
      { from: fileId, path: toPath, overwrite: 'false' },
      undefined,
      context.abortSignal,
    )

    if (result['href']) {
      await yadiskAwaitOperation(result['href'] as string, auth.accessToken, context.abortSignal)
    }

    const data = await yadiskRequest('GET', '/resources', auth.accessToken, { path: toPath }, undefined, context.abortSignal)

    return { file: yadiskResourceToProviderFile(data) }
  }

  async renameFile(request: RenameFileRequest): Promise<RenameFileResponse> {
    const { context, auth, fileId, newName } = request

    const segments = fileId.split('/')
    segments[segments.length - 1] = newName
    const toPath = segments.join('/')

    const result = await yadiskRequest(
      'POST',
      '/resources/move',
      auth.accessToken,
      { from: fileId, path: toPath, overwrite: 'false' },
      undefined,
      context.abortSignal,
    )

    if (result['href']) {
      await yadiskAwaitOperation(result['href'] as string, auth.accessToken, context.abortSignal)
    }

    const data = await yadiskRequest('GET', '/resources', auth.accessToken, { path: toPath }, undefined, context.abortSignal)

    return { file: yadiskResourceToProviderFile(data) }
  }

  async deleteFile(request: DeleteFileRequest): Promise<void> {
    const { context, auth, fileId } = request

    const result = await yadiskRequest(
      'DELETE',
      '/resources',
      auth.accessToken,
      { path: fileId, permanently: 'true' },
      undefined,
      context.abortSignal,
    )

    if (result['href']) {
      await yadiskAwaitOperation(result['href'] as string, auth.accessToken, context.abortSignal)
    }
  }

  async downloadStream(request: DownloadStreamRequest): Promise<DownloadStreamResponse> {
    const { context, auth, fileId, range } = request

    const linkData = await yadiskRequest(
      'GET',
      '/resources/download',
      auth.accessToken,
      { path: fileId },
      undefined,
      context.abortSignal,
    )

    const downloadUrl = linkData['href'] as string

    const headers: Record<string, string> = {}
    if (range) {
      const end = range.end !== undefined ? range.end : ''
      headers['Range'] = `bytes=${range.start}-${end}`
    }

    const res = await fetch(downloadUrl, { headers, signal: context.abortSignal })

    if (!res.ok) {
      throw new AppError({
        code: mapYadiskStatus(res.status),
        message: `Yandex Disk download failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    if (!res.body) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'Yandex Disk response has no body' })
    }

    const fileMeta = await this.getFile({ context, auth, fileId })
    const stream = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
    const contentLength = res.headers.get('content-length')

    return {
      file: fileMeta.file,
      stream,
      contentLength: contentLength ? Number(contentLength) : undefined,
    }
  }

  async uploadStream(request: UploadStreamRequest): Promise<UploadStreamResponse> {
    const { context, auth, parentId = 'disk:/', fileName, contentType, stream } = request

    const filePath = parentId.endsWith('/') ? `${parentId}${fileName}` : `${parentId}/${fileName}`

    const linkData = await yadiskRequest(
      'GET',
      '/resources/upload',
      auth.accessToken,
      { path: filePath, overwrite: 'true' },
      undefined,
      context.abortSignal,
    )

    const uploadUrl = linkData['href'] as string
    const body = await collectStream(stream)

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType ?? 'application/octet-stream' },
      body: body as unknown as BodyInit,
      signal: context.abortSignal,
    })

    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      throw new AppError({
        code: ErrorCode.TRANSFER_FAILED,
        message: `Yandex Disk upload failed: ${uploadRes.status} ${text}`,
        statusCode: uploadRes.status,
        retryable: uploadRes.status >= 500,
      })
    }

    const data = await yadiskRequest('GET', '/resources', auth.accessToken, { path: filePath }, undefined, context.abortSignal)

    return { file: yadiskResourceToProviderFile(data) }
  }

  async createResumableUpload(
    request: CreateResumableUploadRequest,
  ): Promise<CreateResumableUploadResponse> {
    const { context, auth, parentId = 'disk:/', fileName, contentType, contentLength, chunkSize } = request

    const filePath = parentId.endsWith('/') ? `${parentId}${fileName}` : `${parentId}/${fileName}`

    const linkData = await yadiskRequest(
      'GET',
      '/resources/upload',
      auth.accessToken,
      { path: filePath, overwrite: 'true' },
      undefined,
      context.abortSignal,
    )

    const uploadUrl = linkData['href'] as string

    return {
      session: {
        sessionId: `yandex-${context.requestId}`,
        providerUploadId: uploadUrl,
        parentId: filePath,
        fileName,
        contentType: contentType ?? 'application/octet-stream',
        contentLength,
        chunkSize,
        nextOffset: 0,
      },
    }
  }

  async uploadResumableChunk(
    request: UploadResumableChunkRequest,
  ): Promise<UploadResumableChunkResponse> {
    const { context, auth: _auth, session, offset, chunkLength, payload } = request

    let body: Buffer
    if (Buffer.isBuffer(payload)) {
      body = payload
    } else if (payload instanceof Uint8Array) {
      body = Buffer.from(payload)
    } else {
      body = await collectStream(payload as Readable)
    }

    const rangeEnd = offset + chunkLength - 1
    const totalSize = session.contentLength

    const res = await fetch(session.providerUploadId, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${offset}-${rangeEnd}/${totalSize}`,
        'Content-Length': String(chunkLength),
        'Content-Type': session.contentType ?? 'application/octet-stream',
      },
      body: body as unknown as BodyInit,
      signal: context.abortSignal,
    })

    const completed = res.status === 200 || res.status === 201 || res.status === 202

    if (!completed && res.status !== 308 && res.status !== 416) {
      throw new AppError({
        code: ErrorCode.CHUNK_FAILED,
        message: `Yandex Disk chunk upload failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    const rangeHeader = res.headers.get('Range')
    const committedOffset = rangeHeader
      ? Number(rangeHeader.split('-')[1]) + 1
      : offset + chunkLength

    return {
      session: { ...session, nextOffset: committedOffset },
      committedOffset,
      completed: completed || committedOffset >= session.contentLength,
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
        'Content-Type': session.contentType ?? 'application/octet-stream',
      },
      signal: context.abortSignal,
    })

    if (res.status === 308) {
      const rangeHeader = res.headers.get('Range')
      const nextOffset = rangeHeader ? Number(rangeHeader.split('-')[1]) + 1 : session.nextOffset
      return { session: { ...session, nextOffset } }
    }

    if (res.status === 200 || res.status === 201) {
      return { session: { ...session, nextOffset: session.contentLength } }
    }

    return { session }
  }

  async finalizeResumableUpload(
    request: FinalizeResumableUploadRequest,
  ): Promise<FinalizeResumableUploadResponse> {
    const { context, auth, session } = request

    const filePath = session.parentId ?? `disk:/${session.fileName}`
    const data = await yadiskRequest('GET', '/resources', auth.accessToken, { path: filePath }, undefined, context.abortSignal)

    const file: ProviderFile =
      Object.keys(data).length > 0
        ? yadiskResourceToProviderFile(data)
        : {
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
    const { context, auth, fileId } = request

    await yadiskRequest(
      'PUT',
      '/resources/publish',
      auth.accessToken,
      { path: fileId },
      undefined,
      context.abortSignal,
    )

    const data = await yadiskRequest(
      'GET',
      '/resources',
      auth.accessToken,
      { path: fileId, fields: 'resource_id,public_url,public_key' },
      undefined,
      context.abortSignal,
    )

    return {
      link: {
        id: (data['public_key'] as string | undefined) ?? (data['resource_id'] as string),
        url: data['public_url'] as string,
      },
    }
  }

  async revokeShareLink(request: RevokeShareLinkRequest): Promise<void> {
    const { context, auth, fileId } = request

    await yadiskRequest(
      'PUT',
      '/resources/unpublish',
      auth.accessToken,
      { path: fileId },
      undefined,
      context.abortSignal,
    )
  }
}

