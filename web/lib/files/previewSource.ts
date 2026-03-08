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
