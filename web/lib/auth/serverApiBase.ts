const DEFAULT_API_BASE = 'http://127.0.0.1:8100';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function isLoopbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

function getCandidates(): string[] {
  const raw = [
    process.env.API_INTERNAL_URL,
    process.env.CACHEFLOW_API_INTERNAL_URL,
    process.env.API_URL,
    process.env.NEXT_PUBLIC_API_URL,
    DEFAULT_API_BASE,
    'http://localhost:8100',
  ].filter(Boolean) as string[];

  const unique = new Set<string>();
  for (const value of raw) {
    unique.add(normalizeBaseUrl(value));
  }
  return Array.from(unique);
}

/**
 * Resolve the backend API base for server-side route handlers.
 * Prefers non-loopback targets in production-style deployments where
 * Next and API may run in separate hosts/containers.
 */
export function resolveServerApiBase(): string {
  const candidates = getCandidates();
  const nonLoopback = candidates.find((candidate) => !isLoopbackUrl(candidate));
  return nonLoopback || candidates[0] || DEFAULT_API_BASE;
}
