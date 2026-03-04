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

const BOX_API = 'https://api.box.com/2.0'
const BOX_UPLOAD_API = 'https://upload.box.com/api/2.0'
const BOX_AUTH_API = 'https://api.box.com/oauth2'

export const boxDescriptor: ProviderDescriptor = {
  id: 'box',
  displayName: 'Box',
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

function boxItemToProviderFile(raw: Record<string, unknown>): ProviderFile {
  const type = raw['type'] as string

  return {
    id: String(raw['id']),
    name: raw['name'] as string,
    isFolder: type === 'folder',
    size: raw['size'] !== undefined ? Number(raw['size']) : 0,
    parentId:
      raw['parent'] !== null && raw['parent'] !== undefined
        ? String((raw['parent'] as Record<string, unknown>)['id'])
        : undefined,
    mimeType: raw['content_type'] as string | undefined,
    etag: raw['etag'] as string | undefined,
    checksum: raw['sha1'] as string | undefined,
    createdAt: raw['created_at'] as string | undefined,
    modifiedAt: raw['modified_at'] as string | undefined,
    webUrl: raw['shared_link']
      ? (raw['shared_link'] as Record<string, string>)['url']
      : undefined,
  }
}

function mapBoxStatus(status: number): ErrorCode {
  if (status === 401) return ErrorCode.UNAUTHORIZED
  if (status === 403) return ErrorCode.FORBIDDEN
  if (status === 404) return ErrorCode.NOT_FOUND
  if (status === 409) return ErrorCode.CONFLICT
  if (status === 429) return ErrorCode.RATE_LIMITED
  if (status === 507) return ErrorCode.QUOTA_EXCEEDED
  return ErrorCode.PROVIDER_UNAVAILABLE
}

async function boxRequest(
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

  const res = await fetch(`${BOX_API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new AppError({
      code: mapBoxStatus(res.status),
      message: `Box ${method} ${path} failed: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status === 429 || res.status >= 500,
    })
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
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

export class BoxAdapter implements ProviderAdapter {
  readonly descriptor: ProviderDescriptor = boxDescriptor

  async connect(request: ConnectRequest): Promise<ConnectResponse> {
    const { context, code } = request

    if (!code) {
      throw new AppError({ code: ErrorCode.VALIDATION_FAILED, message: 'OAuth code required' })
    }

    const clientId = process.env['BOX_CLIENT_ID']
    const clientSecret = process.env['BOX_CLIENT_SECRET']
    const redirectUri = process.env['BOX_REDIRECT_URI']

    if (!clientId || !clientSecret || !redirectUri) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'Box OAuth env vars missing' })
    }

    const tokenRes = await fetch(`${BOX_AUTH_API}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
      signal: context.abortSignal,
    })

    if (!tokenRes.ok) {
      throw new AppError({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Box OAuth token exchange failed',
        statusCode: tokenRes.status,
      })
    }

    const tokens = (await tokenRes.json()) as Record<string, unknown>
    const accessToken = tokens['access_token'] as string

    const me = await boxRequest('GET', '/users/me', accessToken, undefined, undefined, context.abortSignal)

    const accountId = String(me['id'])

    return {
      account: {
        accountId,
        email: me['login'] as string | undefined,
        displayName: me['name'] as string | undefined,
        avatarUrl: me['avatar_url'] as string | undefined,
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

    const clientId = process.env['BOX_CLIENT_ID']
    const clientSecret = process.env['BOX_CLIENT_SECRET']

    if (!clientId || !clientSecret) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'Box OAuth env vars missing' })
    }

    const res = await fetch(`${BOX_AUTH_API}/token`, {
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
        message: 'Box token refresh failed',
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

  async disconnect(request: DisconnectRequest): Promise<void> {
    const { context, auth } = request

    const clientId = process.env['BOX_CLIENT_ID']
    const clientSecret = process.env['BOX_CLIENT_SECRET']

    if (!clientId || !clientSecret) return

    await fetch(`${BOX_AUTH_API}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: auth.accessToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      signal: context.abortSignal,
    })
  }

  async validateAuth(request: ValidateAuthRequest): Promise<ValidateAuthResponse> {
    const { context, auth } = request

    try {
      await boxRequest('GET', '/users/me', auth.accessToken, undefined, undefined, context.abortSignal)
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

    const data = await boxRequest('GET', '/users/me', auth.accessToken, undefined, undefined, context.abortSignal)

    const total = Number(data['space_amount'] ?? 0)
    const used = Number(data['space_used'] ?? 0)

    return {
      quota: {
        usedBytes: used,
        totalBytes: total,
        freeBytes: Math.max(0, total - used),
      },
    }
  }

  async listFiles(request: ListFilesRequest): Promise<ListFilesResponse> {
    const { context, auth, folderId = '0', cursor, pageSize = 100 } = request

    const params = new URLSearchParams({
      fields: 'id,name,type,size,parent,content_type,etag,sha1,created_at,modified_at',
      limit: String(pageSize),
    })

    if (cursor) {
      params.set('marker', cursor)
    }

    const data = await boxRequest(
      'GET',
      `/folders/${folderId}/items?${params.toString()}`,
      auth.accessToken,
      undefined,
      undefined,
      context.abortSignal,
    )

    const entries = (data['entries'] as Record<string, unknown>[]) ?? []

    return {
      files: entries.map(boxItemToProviderFile),
      nextCursor: data['next_marker'] as string | undefined,
      hasMore: data['next_marker'] !== undefined && data['next_marker'] !== null,
    }
  }

  async searchFiles(request: SearchFilesRequest): Promise<SearchFilesResponse> {
    const { context, auth, query, folderId, cursor, pageSize = 50 } = request

    const params = new URLSearchParams({
      query,
      fields: 'id,name,type,size,parent,content_type,etag,sha1,created_at,modified_at',
      limit: String(pageSize),
    })

    if (folderId) {
      params.set('ancestor_folder_ids', folderId)
    }

    if (cursor) {
      params.set('offset', cursor)
    }

    const data = await boxRequest(
      'GET',
      `/search?${params.toString()}`,
      auth.accessToken,
      undefined,
      undefined,
      context.abortSignal,
    )

    const entries = (data['entries'] as Record<string, unknown>[]) ?? []
    const total = Number(data['total_count'] ?? 0)
    const offset = Number(data['offset'] ?? 0)
    const limit = Number(data['limit'] ?? pageSize)

    const hasMore = offset + limit < total
    const nextOffset = offset + limit

    return {
      files: entries.map(boxItemToProviderFile),
      nextCursor: hasMore ? String(nextOffset) : undefined,
      hasMore,
    }
  }

  async getFile(request: GetFileRequest): Promise<GetFileResponse> {
    const { context, auth, fileId } = request

    try {
      const data = await boxRequest(
        'GET',
        `/files/${fileId}?fields=id,name,type,size,parent,content_type,etag,sha1,created_at,modified_at`,
        auth.accessToken,
        undefined,
        undefined,
        context.abortSignal,
      )
      return { file: boxItemToProviderFile(data) }
    } catch (err) {
      if (AppError.isAppError(err) && err.code === ErrorCode.NOT_FOUND) {
        const data = await boxRequest(
          'GET',
          `/folders/${fileId}?fields=id,name,type,size,parent,etag,created_at,modified_at`,
          auth.accessToken,
          undefined,
          undefined,
          context.abortSignal,
        )
        return { file: boxItemToProviderFile(data) }
      }
      throw err
    }
  }

  async createFolder(request: CreateFolderRequest): Promise<CreateFolderResponse> {
    const { context, auth, name, parentId = '0' } = request

    const data = await boxRequest(
      'POST',
      '/folders',
      auth.accessToken,
      { name, parent: { id: parentId } },
      undefined,
      context.abortSignal,
    )

    return { folder: boxItemToProviderFile(data) }
  }

  async moveFile(request: MoveFileRequest): Promise<MoveFileResponse> {
    const { context, auth, fileId, newParentId, newName } = request

    const body: Record<string, unknown> = { parent: { id: newParentId } }
    if (newName) body['name'] = newName

    const data = await boxRequest(
      'PUT',
      `/files/${fileId}`,
      auth.accessToken,
      body,
      undefined,
      context.abortSignal,
    )

    return { file: boxItemToProviderFile(data) }
  }

  async copyFile(request: CopyFileRequest): Promise<CopyFileResponse> {
    const { context, auth, fileId, newParentId, newName } = request

    const body: Record<string, unknown> = { parent: { id: newParentId } }
    if (newName) body['name'] = newName

    const data = await boxRequest(
      'POST',
      `/files/${fileId}/copy`,
      auth.accessToken,
      body,
      undefined,
      context.abortSignal,
    )

    return { file: boxItemToProviderFile(data) }
  }

  async renameFile(request: RenameFileRequest): Promise<RenameFileResponse> {
    const { context, auth, fileId, newName } = request

    const data = await boxRequest(
      'PUT',
      `/files/${fileId}`,
      auth.accessToken,
      { name: newName },
      undefined,
      context.abortSignal,
    )

    return { file: boxItemToProviderFile(data) }
  }

  async deleteFile(request: DeleteFileRequest): Promise<void> {
    const { context, auth, fileId } = request

    const res = await fetch(`${BOX_API}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      signal: context.abortSignal,
    })

    if (!res.ok && res.status !== 204) {
      throw new AppError({
        code: mapBoxStatus(res.status),
        message: `Box DELETE /files/${fileId} failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }
  }

  async downloadStream(request: DownloadStreamRequest): Promise<DownloadStreamResponse> {
    const { context, auth, fileId, range } = request

    const headers: Record<string, string> = {
      Authorization: `Bearer ${auth.accessToken}`,
    }

    if (range) {
      const end = range.end !== undefined ? range.end : ''
      headers['Range'] = `bytes=${range.start}-${end}`
    }

    const res = await fetch(`${BOX_API}/files/${fileId}/content`, {
      headers,
      redirect: 'follow',
      signal: context.abortSignal,
    })

    if (!res.ok) {
      throw new AppError({
        code: mapBoxStatus(res.status),
        message: `Box download failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    if (!res.body) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'Box response has no body' })
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
    const { context, auth, parentId = '0', fileName, contentType, stream } = request

    const body = await collectStream(stream)

    const form = new FormData()
    form.append(
      'attributes',
      JSON.stringify({ name: fileName, parent: { id: parentId } }),
    )
    form.append('file', new Blob([new Uint8Array(body)], { type: contentType ?? 'application/octet-stream' }), fileName)

    const res = await fetch(`${BOX_UPLOAD_API}/files/content`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      body: form,
      signal: context.abortSignal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new AppError({
        code: res.status === 409 ? ErrorCode.CONFLICT : mapBoxStatus(res.status),
        message: `Box upload failed: ${res.status} ${text}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    const data = (await res.json()) as Record<string, unknown>
    const entries = (data['entries'] as Record<string, unknown>[]) ?? [data]

    return { file: boxItemToProviderFile(entries[0]) }
  }

  async createResumableUpload(
    request: CreateResumableUploadRequest,
  ): Promise<CreateResumableUploadResponse> {
    const { context, auth, parentId = '0', fileName, contentType, contentLength, chunkSize } = request

    const res = await fetch(`${BOX_UPLOAD_API}/files/upload_sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        folder_id: parentId,
        file_name: fileName,
        file_size: contentLength,
      }),
      signal: context.abortSignal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new AppError({
        code: mapBoxStatus(res.status),
        message: `Box upload session create failed: ${res.status} ${text}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    const data = (await res.json()) as Record<string, unknown>
    const sessionId = data['id'] as string

    return {
      session: {
        sessionId: `box-${context.requestId}`,
        providerUploadId: sessionId,
        parentId,
        fileName,
        contentType: contentType ?? 'application/octet-stream',
        contentLength,
        chunkSize: Number((data['part_size'] as number | undefined) ?? chunkSize),
        nextOffset: 0,
        expiresAt: data['session_expires_at'] as string | undefined,
      },
    }
  }

  async uploadResumableChunk(
    request: UploadResumableChunkRequest,
  ): Promise<UploadResumableChunkResponse> {
    const { context, auth, session, offset, chunkLength, payload } = request

    let body: Buffer
    if (Buffer.isBuffer(payload)) {
      body = payload
    } else if (payload instanceof Uint8Array) {
      body = Buffer.from(payload)
    } else {
      body = await collectStream(payload as Readable)
    }

    const rangeEnd = offset + chunkLength - 1
    const digest = `sha=${Buffer.from(body).toString('base64')}`

    const res = await fetch(`${BOX_UPLOAD_API}/files/upload_sessions/${session.providerUploadId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${offset}-${rangeEnd}/${session.contentLength}`,
        'Content-Length': String(chunkLength),
        Digest: digest,
      },
      body: body as unknown as BodyInit,
      signal: context.abortSignal,
    })

    if (!res.ok) {
      throw new AppError({
        code: ErrorCode.CHUNK_FAILED,
        message: `Box chunk upload failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status === 429 || res.status >= 500,
      })
    }

    const committedOffset = offset + chunkLength
    const completed = committedOffset >= session.contentLength

    return {
      session: { ...session, nextOffset: committedOffset },
      committedOffset,
      completed,
    }
  }

  async getResumableUploadStatus(
    request: GetResumableUploadStatusRequest,
  ): Promise<GetResumableUploadStatusResponse> {
    const { context, auth, session } = request

    const data = await boxRequest(
      'GET',
      `/files/upload_sessions/${session.providerUploadId}`,
      auth.accessToken,
      undefined,
      { 'Content-Base-URL': BOX_UPLOAD_API },
      context.abortSignal,
    )

    const nextOffset = data['num_parts_processed'] !== undefined
      ? Number(data['num_parts_processed']) * session.chunkSize
      : session.nextOffset

    return { session: { ...session, nextOffset } }
  }

  async finalizeResumableUpload(
    request: FinalizeResumableUploadRequest,
  ): Promise<FinalizeResumableUploadResponse> {
    const { context, auth, session } = request

    const res = await fetch(`${BOX_UPLOAD_API}/files/upload_sessions/${session.providerUploadId}/commit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/json',
        Digest: 'sha=',
      },
      body: JSON.stringify({ parts: [] }),
      signal: context.abortSignal,
    })

    if (!res.ok && res.status !== 202) {
      const text = await res.text()
      throw new AppError({
        code: ErrorCode.TRANSFER_FAILED,
        message: `Box upload commit failed: ${res.status} ${text}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    const data = (await res.json()) as Record<string, unknown>
    const entries = (data['entries'] as Record<string, unknown>[]) ?? [data]
    const raw = entries[0] ?? {}

    const file: ProviderFile =
      Object.keys(raw).length > 0
        ? boxItemToProviderFile(raw)
        : {
            id: session.providerUploadId,
            name: session.fileName,
            isFolder: false,
            size: session.contentLength,
            mimeType: session.contentType,
          }

    return { session, file }
  }

  async abortResumableUpload(request: AbortResumableUploadRequest): Promise<void> {
    const { context, auth, session } = request

    const res = await fetch(`${BOX_UPLOAD_API}/files/upload_sessions/${session.providerUploadId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      signal: context.abortSignal,
    })

    if (!res.ok && res.status !== 204) {
      throw new AppError({
        code: ErrorCode.TRANSFER_FAILED,
        message: `Box upload session abort failed: ${res.status}`,
        statusCode: res.status,
        retryable: false,
      })
    }
  }

  async createShareLink(request: CreateShareLinkRequest): Promise<CreateShareLinkResponse> {
    const { context, auth, fileId, expiresAt, password } = request

    const sharedLink: Record<string, unknown> = { access: 'open' }
    if (expiresAt) sharedLink['unshared_at'] = expiresAt
    if (password) sharedLink['password'] = password

    const data = await boxRequest(
      'PUT',
      `/files/${fileId}?fields=id,shared_link`,
      auth.accessToken,
      { shared_link: sharedLink },
      undefined,
      context.abortSignal,
    )

    const link = data['shared_link'] as Record<string, unknown>

    return {
      link: {
        id: String(data['id']),
        url: link['url'] as string,
        expiresAt: link['unshared_at'] as string | undefined,
        passwordProtected: password !== undefined,
      },
    }
  }

  async revokeShareLink(request: RevokeShareLinkRequest): Promise<void> {
    const { context, auth, fileId } = request

    await boxRequest(
      'PUT',
      `/files/${fileId}?fields=id,shared_link`,
      auth.accessToken,
      { shared_link: null },
      undefined,
      context.abortSignal,
    )
  }
}
