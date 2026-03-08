const DEFAULT_API_URL = 'http://localhost:8100'

function ensureUrl(value: string, envName: string): string {
  try {
    // Validate format and normalize by trimming trailing slash.
    new URL(value)
    return value.replace(/\/+$/, '')
  } catch {
    throw new Error(`Invalid ${envName}: ${value}`)
  }
}

export function getPublicApiUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL
  return ensureUrl(raw, 'NEXT_PUBLIC_API_URL')
}

