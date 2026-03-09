import type { FileMetadata } from '@/lib/providers/types'

export const TEXT_PREVIEW_BYTES = 64 * 1024

interface PreviewFetchRequest {
  url: string
  init: RequestInit
}

function buildAuthHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function resolveDirectPreviewUrl(
  file: FileMetadata,
  fallbackAccountKey?: string,
): string | null {
  const accountKey = String((file as any).accountKey || fallbackAccountKey || '')

  if (file.provider === 'vps' && accountKey) {
    return `/api/providers/vps/${encodeURIComponent(accountKey)}/files/download?path=${encodeURIComponent(file.id)}`
  }

  return null
}

export function resolveMediaStreamUrl(
  file: FileMetadata,
  fallbackAccountKey?: string,
): string | null {
  const accountKey = String((file as any).accountKey || fallbackAccountKey || '')
  const fileId = file.id
  const provider = file.provider

  if (provider === 'vps' && accountKey) {
    return `/api/remotes/${encodeURIComponent(accountKey)}/stream?path=${encodeURIComponent(fileId)}`
  }

  if (provider === 'local') {
    return `/api/files/stream?id=${encodeURIComponent(fileId)}`
  }

  return `/api/remotes/${encodeURIComponent(accountKey || 'default')}/stream?fileId=${encodeURIComponent(fileId)}&provider=${encodeURIComponent(provider)}`
}

export function buildMediaStreamRequest(
  file: FileMetadata,
  options: {
    token?: string
    fallbackAccountKey?: string
    range?: string
  } = {},
): PreviewFetchRequest | null {
  const streamUrl = resolveMediaStreamUrl(file, options.fallbackAccountKey)
  if (!streamUrl) return null

  const authHeaders = buildAuthHeaders(options.token)
  const headers: Record<string, string> = { ...authHeaders }
  if (options.range) {
    headers['Range'] = options.range
  }

  return {
    url: streamUrl,
    init: {
      method: 'GET',
      credentials: 'include',
      headers,
    },
  }
}

export function buildTextPreviewRequest(
  file: FileMetadata,
  options: {
    token?: string
    fallbackAccountKey?: string
    byteCount?: number
  } = {},
): PreviewFetchRequest | null {
  const byteCount = options.byteCount ?? TEXT_PREVIEW_BYTES
  const rangeValue = `bytes=0-${Math.max(byteCount - 1, 0)}`
  const authHeaders = buildAuthHeaders(options.token)

  if (file.provider === 'vps') {
    const url = resolveDirectPreviewUrl(file, options.fallbackAccountKey)
    if (!url) return null
    return {
      url,
      init: {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...authHeaders,
          Range: rangeValue,
        },
      },
    }
  }

  if (file.provider === 'local') {
    return {
      url: '/api/files/download',
      init: {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
          Range: rangeValue,
        },
        body: JSON.stringify({ id: file.id }),
      },
    }
  }

  return null
}
