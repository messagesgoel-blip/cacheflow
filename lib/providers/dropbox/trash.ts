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

const DBX_API = 'https://api.dropboxapi.com/2'

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
    isTrashed: tag === 'deleted',
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
      code: res.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.PROVIDER_UNAVAILABLE,
      message: `Dropbox POST ${endpoint} failed: ${res.status} ${text}`,
      statusCode: res.status,
      retryable: res.status >= 500,
    })
  }

  return res.json() as Promise<Record<string, unknown>>
}

export async function listTrash(request: ListTrashRequest): Promise<ListTrashResponse> {
  const { context, auth } = request

  // Dropbox doesn't have a single trash folder. We use list_folder with include_deleted.
  // This is not perfect for a "Trash" view, but it's what's available.
  // Actually, we'll list deleted items in the root for now.
  const data = await dbxPost(
    '/files/list_folder',
    auth.accessToken,
    { path: '', recursive: true, include_deleted: true },
    context.abortSignal,
  )

  const entries = (data['entries'] as Record<string, unknown>[]) ?? []
  const deletedEntries = entries.filter((e) => e['.tag'] === 'deleted')

  return {
    files: deletedEntries.map(dropboxEntryToProviderFile),
    nextCursor: data['has_more'] ? (data['cursor'] as string) : undefined,
    hasMore: Boolean(data['has_more']),
  }
}

export async function restoreFile(_request: RestoreFileRequest): Promise<void> {
  // Dropbox "restore" for a deleted file usually means finding its last revision and restoring it.
  // Or if it was just deleted, we can't easily "undelete" without a revision ID.
  throw new AppError({
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Restore file for Dropbox requires a revision ID. Use restoreFileVersion instead.',
    retryable: false,
  })
}

export async function emptyTrash(_request: EmptyTrashRequest): Promise<void> {
  throw new AppError({
    code: ErrorCode.VALIDATION_FAILED,
    message: 'Empty trash is not supported for Dropbox via API.',
    retryable: false,
  })
}

export async function listFileVersions(request: ListFileVersionsRequest): Promise<ListFileVersionsResponse> {
  const { context, auth, fileId } = request

  const data = await dbxPost(
    '/files/list_revisions',
    auth.accessToken,
    { path: fileId, limit: 10 },
    context.abortSignal,
  )

  const entries = (data['entries'] as Record<string, unknown>[]) ?? []

  return {
    versions: entries.map((e) => ({
      id: e['rev'] as string,
      modifiedAt: e['server_modified'] as string,
      size: e['size'] !== undefined ? Number(e['size']) : undefined,
    })),
  }
}

export async function restoreFileVersion(request: RestoreFileVersionRequest): Promise<void> {
  const { context, auth, fileId, versionId } = request
  await dbxPost(
    '/files/restore',
    auth.accessToken,
    { path: fileId, rev: versionId },
    context.abortSignal,
  )
}
