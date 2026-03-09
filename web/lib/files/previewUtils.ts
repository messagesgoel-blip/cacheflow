const TEXT_MIME_PREFIXES = ['text/']
const TEXT_MIME_EXACT = new Set([
  'application/json',
  'application/ld+json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
])

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'log',
  'xml',
  'html',
  'htm',
  'js',
  'ts',
  'tsx',
  'jsx',
  'css',
  'yml',
  'yaml',
])

export type PreviewType = 'image' | 'pdf' | 'text' | 'video' | 'audio' | 'other'

export function resolvePreviewType(input: { mimeType?: string; fileName?: string }): PreviewType {
  const mimeType = (input.mimeType || '').toLowerCase().trim()
  const mimeMain = mimeType.split(';')[0].trim()
  const ext = (input.fileName || '').toLowerCase().split('.').pop() || ''

  if (mimeMain.startsWith('image/')) return 'image'
  if (mimeMain.startsWith('video/')) return 'video'
  if (mimeMain.startsWith('audio/')) return 'audio'
  if (mimeMain === 'application/pdf') return 'pdf'
  if (TEXT_MIME_PREFIXES.some((prefix) => mimeMain.startsWith(prefix))) return 'text'
  if (TEXT_MIME_EXACT.has(mimeMain)) return 'text'
  if (TEXT_EXTENSIONS.has(ext)) return 'text'

  return 'other'
}

export function isTextPreviewEligible(input: { size?: number }): boolean {
  const size = typeof input.size === 'number' ? input.size : 0
  return size <= 1024 * 1024
}

export function isMediaStreamable(input: { size?: number }): boolean {
  const size = typeof input.size === 'number' ? input.size : 0
  return size <= 10 * 1024 * 1024 * 1024
}
