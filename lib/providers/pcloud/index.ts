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

const PCLOUD_API = 'https://api.pcloud.com'
const PCLOUD_EU_API = 'https://eapi.pcloud.com'
const PCLOUD_AUTH_API = 'https://api.pcloud.com'

export const pcloudDescriptor: ProviderDescriptor = {
  id: 'pcloud',
  displayName: 'pCloud',
  authType: 'oauth2',
  capabilities: {
    supportsAuthRefresh: false,
    supportsSearch: true,
    supportsShareLinks: true,
    supportsResumableUpload: true,
    supportsChunkResume: false,
    supportsStreamingTransfer: true,
    supportsServerSideCopy: true,
  },
}

function pcloudMetaToProviderFile(raw: Record<string, unknown>): ProviderFile {
  const isFolder = Boolean(raw['isfolder'])

  return {
    id: String(raw['fileid'] ?? raw['folderid'] ?? raw['id']),
    name: raw['name'] as string,
    isFolder,
    size: raw['size'] !== undefined ? Number(raw['size']) : 0,
    parentId: raw['parentfolderid'] !== undefined ? String(raw['parentfolderid']) : undefined,
    mimeType: raw['contenttype'] as string | undefined,
    checksum: raw['sha256'] as string | undefined,
    createdAt: raw['created'] as string | undefined,
    modifiedAt: raw['modified'] as string | undefined,
  }
}

function pcloudApiBase(auth: { accountId: string }): string {
  return auth.accountId.startsWith('eu') ? PCLOUD_EU_API : PCLOUD_API
}

function mapPcloudError(result: number): ErrorCode {
  if (result === 1000) return ErrorCode.UNAUTHORIZED
  if (result === 2000 || result === 2001 || result === 2002 || result === 2003 || result === 2005) return ErrorCode.VALIDATION_FAILED
  if (result === 2009 || result === 2010) return ErrorCode.NOT_FOUND
  if (result === 2004) return ErrorCode.CONFLICT
  if (result === 4000) return ErrorCode.QUOTA_EXCEEDED
  return ErrorCode.PROVIDER_UNAVAILABLE
}

async function pcloudGet(
  base: string,
  endpoint: string,
  accessToken: string,
  params?: Record<string, string>,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const url = new URL(`${base}/${endpoint}`)
  url.searchParams.set('access_token', accessToken)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }

  const res = await fetch(url.toString(), { signal })

  if (!res.ok) {
    const text = await res.text()
    throw new AppError({
      code: res.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.PROVIDER_UNAVAILABLE,
      message: `pCloud GET ${endpoint} failed: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status >= 500,
    })
  }

  const data = (await res.json()) as Record<string, unknown>
  const result = data['result'] as number | undefined

  if (result !== undefined && result !== 0) {
    throw new AppError({
      code: mapPcloudError(result),
      message: `pCloud ${endpoint} error ${result}: ${data['error'] ?? 'unknown'}`,
      retryable: false,
    })
  }

  return data
}

async function pcloudPost(
  base: string,
  endpoint: string,
  accessToken: string,
  params?: Record<string, string>,
  body?: Buffer,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const url = new URL(`${base}/${endpoint}`)
  url.searchParams.set('access_token', accessToken)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }

  const fetchOpts: RequestInit = {
    method: 'POST',
    signal,
  }

  if (body) {
    fetchOpts.headers = { 'Content-Type': 'application/octet-stream' }
    fetchOpts.body = body as unknown as BodyInit
  }

  const res = await fetch(url.toString(), fetchOpts)

  if (!res.ok) {
    const text = await res.text()
    throw new AppError({
      code: res.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.PROVIDER_UNAVAILABLE,
      message: `pCloud POST ${endpoint} failed: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status >= 500,
    })
  }

  const data = (await res.json()) as Record<string, unknown>
  const result = data['result'] as number | undefined

  if (result !== undefined && result !== 0) {
    throw new AppError({
      code: mapPcloudError(result),
      message: `pCloud ${endpoint} error ${result}: ${data['error'] ?? 'unknown'}`,
      retryable: false,
    })
  }

  return data
}

async function collectStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array))
  }
  return Buffer.concat(chunks)
}

export class PCloudAdapter implements ProviderAdapter {
  readonly descriptor: ProviderDescriptor = pcloudDescriptor

  async connect(request: ConnectRequest): Promise<ConnectResponse> {
    const { context, code } = request

    if (!code) {
      throw new AppError({ code: ErrorCode.VALIDATION_FAILED, message: 'OAuth code required' })
    }

    const clientId = process.env['PCLOUD_CLIENT_ID']
    const clientSecret = process.env['PCLOUD_CLIENT_SECRET']
    const redirectUri = process.env['PCLOUD_REDIRECT_URI']

    if (!clientId || !clientSecret || !redirectUri) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'pCloud OAuth env vars missing' })
    }

    const tokenRes = await fetch(`${PCLOUD_AUTH_API}/oauth2_token`, {
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
        message: 'pCloud OAuth token exchange failed',
        statusCode: tokenRes.status,
      })
    }

    const tokens = (await tokenRes.json()) as Record<string, unknown>
    const accessToken = tokens['access_token'] as string
    const locationid = tokens['locationid'] as number | undefined

    const base = locationid === 2 ? PCLOUD_EU_API : PCLOUD_API
    const me = await pcloudGet(base, 'userinfo', accessToken, undefined, context.abortSignal)

    const userId = String(me['userid'])

    return {
      account: {
        accountId: userId,
        email: me['email'] as string | undefined,
        displayName: (me['firstname'] ? `${me['firstname']} ${me['lastname'] ?? ''}`.trim() : undefined),
        avatarUrl: undefined,
      },
      auth: {
        accountId: userId,
        accessToken,
        expiresAt: undefined,
      },
    }
  }

  async refreshAuth(_request: RefreshAuthRequest): Promise<RefreshAuthResponse> {
    throw new AppError({
      code: ErrorCode.REFRESH_FAILED,
      message: 'pCloud OAuth tokens do not expire and cannot be refreshed',
    })
  }

  async disconnect(_request: DisconnectRequest): Promise<void> {}

  async validateAuth(request: ValidateAuthRequest): Promise<ValidateAuthResponse> {
    const { context, auth } = request
    const base = pcloudApiBase(auth)

    try {
      await pcloudGet(base, 'userinfo', auth.accessToken, undefined, context.abortSignal)
      return { valid: true }
    } catch (err) {
      if (AppError.isAppError(err) && err.code === ErrorCode.UNAUTHORIZED) {
        return { valid: false, reason: 'revoked' }
      }
      return { valid: false, reason: 'unknown' }
    }
  }

  async getQuota(request: GetQuotaRequest): Promise<GetQuotaResponse> {
    const { context, auth } = request
    const base = pcloudApiBase(auth)

    const data = await pcloudGet(base, 'userinfo', auth.accessToken, undefined, context.abortSignal)

    const total = Number(data['quota'] ?? 0)
    const used = Number(data['usedquota'] ?? 0)

    return {
      quota: {
        usedBytes: used,
        totalBytes: total,
        freeBytes: Math.max(0, total - used),
      },
    }
  }

  async listFiles(request: ListFilesRequest): Promise<ListFilesResponse> {
    const { context, auth, folderId = '0', pageSize = 100 } = request
    const base = pcloudApiBase(auth)

    const params: Record<string, string> = {
      folderid: folderId,
      nofiles: '0',
      noshares: '1',
    }

    if (request.cursor) {
      params['offset'] = request.cursor
    }

    const data = await pcloudGet(base, 'listfolder', auth.accessToken, params, context.abortSignal)

    const metadata = data['metadata'] as Record<string, unknown> | undefined
    const contents = (metadata?.['contents'] as Record<string, unknown>[]) ?? []

    const sliced = contents.slice(0, pageSize)
    const hasMore = contents.length > pageSize

    return {
      files: sliced.map(pcloudMetaToProviderFile),
      nextCursor: hasMore ? String(Number(request.cursor ?? '0') + pageSize) : undefined,
      hasMore,
    }
  }

  async searchFiles(request: SearchFilesRequest): Promise<SearchFilesResponse> {
    const { context, auth, query, pageSize = 50 } = request
    const base = pcloudApiBase(auth)

    const data = await pcloudGet(base, 'search', auth.accessToken, { query }, context.abortSignal)

    const entries = (data['entries'] as Record<string, unknown>[]) ?? []

    return {
      files: entries.slice(0, pageSize).map(pcloudMetaToProviderFile),
      hasMore: false,
    }
  }

  async getFile(request: GetFileRequest): Promise<GetFileResponse> {
    const { context, auth, fileId } = request
    const base = pcloudApiBase(auth)

    const data = await pcloudGet(
      base,
      'stat',
      auth.accessToken,
      { fileid: fileId },
      context.abortSignal,
    )

    return { file: pcloudMetaToProviderFile(data['metadata'] as Record<string, unknown>) }
  }

  async createFolder(request: CreateFolderRequest): Promise<CreateFolderResponse> {
    const { context, auth, name, parentId = '0' } = request
    const base = pcloudApiBase(auth)

    const data = await pcloudGet(
      base,
      'createfolder',
      auth.accessToken,
      { name, folderid: parentId },
      context.abortSignal,
    )

    return { folder: pcloudMetaToProviderFile(data['metadata'] as Record<string, unknown>) }
  }

  async moveFile(request: MoveFileRequest): Promise<MoveFileResponse> {
    const { context, auth, fileId, newParentId, newName } = request
    const base = pcloudApiBase(auth)

    const params: Record<string, string> = { fileid: fileId, tofolderid: newParentId }
    if (newName) params['toname'] = newName

    const data = await pcloudGet(base, 'renamefile', auth.accessToken, params, context.abortSignal)

    return { file: pcloudMetaToProviderFile(data['metadata'] as Record<string, unknown>) }
  }

  async copyFile(request: CopyFileRequest): Promise<CopyFileResponse> {
    const { context, auth, fileId, newParentId, newName } = request
    const base = pcloudApiBase(auth)

    const params: Record<string, string> = { fileid: fileId, tofolderid: newParentId }
    if (newName) params['toname'] = newName

    const data = await pcloudGet(base, 'copyfile', auth.accessToken, params, context.abortSignal)

    return { file: pcloudMetaToProviderFile(data['metadata'] as Record<string, unknown>) }
  }

  async renameFile(request: RenameFileRequest): Promise<RenameFileResponse> {
    const { context, auth, fileId, newName } = request
    const base = pcloudApiBase(auth)

    const data = await pcloudGet(
      base,
      'renamefile',
      auth.accessToken,
      { fileid: fileId, toname: newName },
      context.abortSignal,
    )

    return { file: pcloudMetaToProviderFile(data['metadata'] as Record<string, unknown>) }
  }

  async deleteFile(request: DeleteFileRequest): Promise<void> {
    const { context, auth, fileId } = request
    const base = pcloudApiBase(auth)

    await pcloudGet(base, 'deletefile', auth.accessToken, { fileid: fileId }, context.abortSignal)
  }

  async downloadStream(request: DownloadStreamRequest): Promise<DownloadStreamResponse> {
    const { context, auth, fileId, range } = request
    const base = pcloudApiBase(auth)

    const linkData = await pcloudGet(
      base,
      'getfilelink',
      auth.accessToken,
      { fileid: fileId },
      context.abortSignal,
    )

    const hosts = linkData['hosts'] as string[]
    const path = linkData['path'] as string
    const downloadUrl = `https://${hosts[0]}${path}`

    const headers: Record<string, string> = {}
    if (range) {
      const end = range.end !== undefined ? range.end : ''
      headers['Range'] = `bytes=${range.start}-${end}`
    }

    const res = await fetch(downloadUrl, { headers, signal: context.abortSignal })

    if (!res.ok) {
      throw new AppError({
        code: ErrorCode.PROVIDER_UNAVAILABLE,
        message: `pCloud download failed: ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500,
      })
    }

    if (!res.body) {
      throw new AppError({ code: ErrorCode.INTERNAL_ERROR, message: 'pCloud response has no body' })
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
    const { context, auth, parentId = '0', fileName, stream } = request
    const base = pcloudApiBase(auth)

    const body = await collectStream(stream)

    const data = await pcloudPost(
      base,
      'uploadfile',
      auth.accessToken,
      { folderid: parentId, filename: fileName, nopartial: '1' },
      body,
      context.abortSignal,
    )

    const fileids = data['fileids'] as number[]
    const metadata = (data['metadata'] as Record<string, unknown>[]) ?? []

    if (metadata.length === 0) {
      return {
        file: {
          id: String(fileids?.[0] ?? ''),
          name: fileName,
          isFolder: false,
          size: body.length,
        },
      }
    }

    return { file: pcloudMetaToProviderFile(metadata[0]) }
  }

  async createResumableUpload(
    request: CreateResumableUploadRequest,
  ): Promise<CreateResumableUploadResponse> {
    const { context, auth, parentId = '0', fileName, contentType, contentLength, chunkSize } = request
    const base = pcloudApiBase(auth)

    const data = await pcloudGet(
      base,
      'upload_create',
      auth.accessToken,
      {
        folderid: parentId,
        filename: fileName,
        filesize: String(contentLength),
      },
      context.abortSignal,
    )

    const uploadid = String(data['uploadid'])

    return {
      session: {
        sessionId: `pcloud-${context.requestId}`,
        providerUploadId: uploadid,
        parentId,
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
    const { context, auth, session, offset, chunkLength, payload } = request
    const base = pcloudApiBase(auth)

    let body: Buffer
    if (Buffer.isBuffer(payload)) {
      body = payload
    } else if (payload instanceof Uint8Array) {
      body = Buffer.from(payload)
    } else {
      body = await collectStream(payload as Readable)
    }

    await pcloudPost(
      base,
      'upload_write',
      auth.accessToken,
      { uploadid: session.providerUploadId, uploadoffset: String(offset) },
      body,
      context.abortSignal,
    )

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
    const base = pcloudApiBase(auth)

    const data = await pcloudGet(
      base,
      'upload_info',
      auth.accessToken,
      { uploadid: session.providerUploadId },
      context.abortSignal,
    )

    const nextOffset = data['currentoffset'] !== undefined
      ? Number(data['currentoffset'])
      : session.nextOffset

    return { session: { ...session, nextOffset } }
  }

  async finalizeResumableUpload(
    request: FinalizeResumableUploadRequest,
  ): Promise<FinalizeResumableUploadResponse> {
    const { context, auth, session } = request
    const base = pcloudApiBase(auth)

    const data = await pcloudGet(
      base,
      'upload_save',
      auth.accessToken,
      {
        uploadid: session.providerUploadId,
        folderid: session.parentId ?? '0',
        name: session.fileName,
      },
      context.abortSignal,
    )

    const metadata = data['metadata'] as Record<string, unknown> | undefined

    const file: ProviderFile = metadata
      ? pcloudMetaToProviderFile(metadata)
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
    const base = pcloudApiBase(auth)

    await pcloudGet(
      base,
      'upload_delete',
      auth.accessToken,
      { uploadid: session.providerUploadId },
      context.abortSignal,
    )
  }

  async createShareLink(request: CreateShareLinkRequest): Promise<CreateShareLinkResponse> {
    const { context, auth, fileId } = request
    const base = pcloudApiBase(auth)

    const data = await pcloudGet(
      base,
      'getfilepublink',
      auth.accessToken,
      { fileid: fileId },
      context.abortSignal,
    )

    return {
      link: {
        id: String(data['linkid'] ?? fileId),
        url: data['link'] as string,
      },
    }
  }

  async revokeShareLink(request: RevokeShareLinkRequest): Promise<void> {
    const { context, auth, linkId } = request
    const base = pcloudApiBase(auth)

    if (!linkId) return

    await pcloudGet(
      base,
      'deletepublink',
      auth.accessToken,
      { linkid: linkId },
      context.abortSignal,
    )
  }
}

