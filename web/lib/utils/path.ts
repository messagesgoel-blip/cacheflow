/**
 * Path normalization utility
 */
export function normalizePath(...parts: string[]): string {
  const combined = parts.join('/')
  const normalized = combined
    .replace(/\/+/g, '/') // Replace multiple slashes with one
    .replace(/\/$/, '')   // Remove trailing slash
  
  return normalized === '' ? '/' : normalized
}
