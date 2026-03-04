/**
 * Provider Health Check — Gate: SYNC-1 — Task: 3.14@SYNC-1
 *
 * Probes connected providers by making a minimal read-only call to each
 * provider's identity endpoint.  Timeout: 2 s per probe.
 * Probes never refresh tokens — expired tokens surface as `needs_reauth`.
 */

import type { ProviderId } from './types'

export type HealthStatus =
  | 'healthy'       // credentials accepted, provider reachable
  | 'needs_reauth'  // 401/403 — token invalid or revoked
  | 'degraded'      // 5xx / network / timeout
  | 'unknown'       // no probe implementation for this provider

export interface HealthProbeResult {
  status: HealthStatus
  checkedAt: string
  httpStatus?: number
  message: string
  latencyMs: number
}

interface ProbeConfig {
  url: string
  method?: 'GET' | 'POST'
  body?: string
  bearerPrefix?: string
  useQueryParam?: boolean
}

const PROBE_CONFIGS: Partial<Record<ProviderId, ProbeConfig>> = {
  google: {
    url: 'https://www.googleapis.com/drive/v3/about?fields=user%28emailAddress%29',
  },
  onedrive: {
    url: 'https://graph.microsoft.com/v1.0/me?$select=userPrincipalName',
  },
  dropbox: {
    // Dropbox get_current_account requires POST with JSON-null body
    url: 'https://api.dropboxapi.com/2/users/get_current_account',
    method: 'POST',
    body: 'null',
  },
  box: {
    url: 'https://api.box.com/2.0/users/me?fields=id,login',
  },
  pcloud: {
    // pCloud requires access_token as a query parameter, not a Bearer header
    url: 'https://api.pcloud.com/userinfo',
    useQueryParam: true,
  },
  yandex: {
    url: 'https://login.yandex.ru/info',
    bearerPrefix: 'OAuth',
  },
}

const PROBE_TIMEOUT_MS = 2_000

export async function probeProvider(
  providerId: string,
  accessToken: string,
): Promise<HealthProbeResult> {
  const checkedAt = new Date().toISOString()
  const config = PROBE_CONFIGS[providerId as ProviderId]

  if (!config) {
    return {
      status: 'unknown',
      checkedAt,
      message: `No probe implementation for provider "${providerId}"`,
      latencyMs: 0,
    }
  }

  const startMs = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    let probeUrl = config.url
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (config.useQueryParam) {
      probeUrl = `${probeUrl}?access_token=${encodeURIComponent(accessToken)}`
    } else {
      const prefix = config.bearerPrefix ?? 'Bearer'
      headers['Authorization'] = `${prefix} ${accessToken}`
    }

    const response = await fetch(probeUrl, {
      method: config.method ?? 'GET',
      headers,
      body: config.body,
      signal: controller.signal,
    })

    return buildResult(response.status, checkedAt, Date.now() - startMs)
  } catch (err: unknown) {
    const latencyMs = Date.now() - startMs
    const isAbort =
      (err instanceof Error && err.name === 'AbortError') ||
      (err instanceof DOMException && err.name === 'AbortError')

    return {
      status: 'degraded',
      checkedAt,
      message: isAbort
        ? `Probe timed out after ${PROBE_TIMEOUT_MS}ms`
        : `Network error: ${err instanceof Error ? err.message : String(err)}`,
      latencyMs,
    }
  } finally {
    clearTimeout(timer)
  }
}

function buildResult(
  httpStatus: number,
  checkedAt: string,
  latencyMs: number,
): HealthProbeResult {
  if (httpStatus >= 200 && httpStatus < 300) {
    return {
      status: 'healthy',
      checkedAt,
      httpStatus,
      message: 'Provider reachable and credentials valid',
      latencyMs,
    }
  }

  if (httpStatus === 401 || httpStatus === 403) {
    return {
      status: 'needs_reauth',
      checkedAt,
      httpStatus,
      message: httpStatus === 401
        ? 'Token invalid or expired'
        : 'Token lacks required permissions',
      latencyMs,
    }
  }

  return {
    status: 'degraded',
    checkedAt,
    httpStatus,
    message: httpStatus === 429
      ? 'Provider is rate-limiting this account'
      : `Unexpected HTTP ${httpStatus} from provider`,
    latencyMs,
  }
}

export interface RemoteHealthInput {
  id: string
  provider: string
  accessToken: string
  displayName?: string
}

export interface RemoteHealthResult {
  id: string
  provider: string
  displayName: string
  probe: HealthProbeResult
}

export async function probeAllProviders(
  remotes: RemoteHealthInput[],
): Promise<RemoteHealthResult[]> {
  return Promise.all(
    remotes.map(async (remote) => {
      let probe: HealthProbeResult
      try {
        probe = await probeProvider(remote.provider, remote.accessToken)
      } catch (err) {
        probe = {
          status: 'degraded',
          checkedAt: new Date().toISOString(),
          message: `Unexpected probe error: ${err instanceof Error ? err.message : String(err)}`,
          latencyMs: 0,
        }
      }
      return {
        id: remote.id,
        provider: remote.provider,
        displayName: remote.displayName ?? remote.id,
        probe,
      }
    }),
  )
}
