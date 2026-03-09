import { AppError } from '../../errors/AppError'
import { ErrorCode } from '../../errors/ErrorCode'
import type {
  EmptyTrashRequest,
  ListFileVersionsRequest,
  ListFileVersionsResponse,
  ListTrashRequest,
  ListTrashResponse,
  ProviderFile,
  RestoreFileRequest,
  RestoreFileVersionRequest,
} from '../types'

const GRAPH_API = 'https://graph.microsoft.com/v1.0'

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
    isTrashed: Boolean((raw['remoteItem'] as Record<string, unknown> | undefined)?.['sharepointIds']) || raw['trashed'] !== undefined,
  }
}

async function graphRequest(
  method: string,
  path: string,
  accessToken: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${GRAPH_API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  if (!res.ok && res.status !== 204) {
    const text = await res.text()
    throw new AppError({
      code: res.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.PROVIDER_UNAVAILABLE,
      message: `OneDrive ${method} ${path} failed: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status >= 500,
    })
  }

  if (res.status === 204) return {}
  return res.json() as Promise<Record<string, unknown>>
}

export async function listTrash(request: ListTrashRequest): Promise<ListTrashResponse> {
  const { context, auth, pageSize = 100 } = request

  // OneDrive recycle bin is accessed via /me/drive/special/trash/children
  const data = await graphRequest(
    'GET',
    `/me/drive/special/trash/children?$top=${pageSize}`,
    auth.accessToken,
    undefined,
    context.abortSignal,
  )

  const rawItems = (data['value'] as Record<string, unknown>[]) ?? []
  const nextLink = data['@odata.nextLink'] as string | undefined

  return {
    files: rawItems.map(driveItemToProviderFile),
    nextCursor: nextLink ? new URL(nextLink).pathname + new URL(nextLink).search : undefined,
    hasMore: Boolean(nextLink),
  }
}

export async function restoreFile(request: RestoreFileRequest): Promise<void> {
  const { context, auth, fileId } = request
  // Restore in OneDrive is POST /me/drive/items/{id}/restore
  await graphRequest('POST', `/me/drive/items/${fileId}/restore`, auth.accessToken, {}, context.abortSignal)
}

export async function emptyTrash(request: EmptyTrashRequest): Promise<void> {
  // Microsoft Graph doesn't have a single "empty trash" endpoint that works across all accounts easily.
  // One way is to list and delete all items in the trash.
  // For now, we'll throw a NOT_SUPPORTED or implement a basic loop.
  throw new AppError({
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Empty trash is not supported via a single API call for OneDrive. Please delete items individually.',
    retryable: false,
  })
}

export async function listFileVersions(request: ListFileVersionsRequest): Promise<ListFileVersionsResponse> {
  const { context, auth, fileId } = request

  const data = await graphRequest(
    'GET',
    `/me/drive/items/${fileId}/versions`,
    auth.accessToken,
    undefined,
    context.abortSignal,
  )

  const versions = (data['value'] as Record<string, unknown>[]) ?? []

  return {
    versions: versions.map((v) => ({
      id: v['id'] as string,
      modifiedAt: v['lastModifiedDateTime'] as string,
      size: v['size'] !== undefined ? Number(v['size']) : undefined,
      author: (v['lastModifiedBy'] as any)?.user?.displayName,
    })),
  }
}

export async function restoreFileVersion(request: RestoreFileVersionRequest): Promise<void> {
  const { context, auth, fileId, versionId } = request
  // POST /me/drive/items/{id}/versions/{vid}/restoreVersion
  await graphRequest(
    'POST',
    `/me/drive/items/${fileId}/versions/${versionId}/restoreVersion`,
    auth.accessToken,
    {},
    context.abortSignal,
  )
}
