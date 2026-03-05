/**
 * Connection Health Endpoint — Gate: SYNC-1 — Task: 3.14@SYNC-1
 *
 * GET /api/connections/health
 * Returns a real liveness probe result for every connected provider.
 * "Green" means the credential actually works — not just that it exists.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { probeProvider } from '@/lib/providers/healthCheck'
import type { HealthProbeResult } from '@/lib/providers/healthCheck'

interface JwtPayload {
  id: string
}

interface BackendRemote {
  id: string
  provider: string
  account_key?: string
  account_email?: string
  display_name?: string
  disabled?: boolean
  expires_at?: string
}

interface ConnectionHealth {
  id: string
  provider: string
  displayName: string
  disabled: boolean
  probe: HealthProbeResult
}

interface HealthResponse {
  success: boolean
  checkedAt: string
  connections: ConnectionHealth[]
}

const DEFAULT_API_BASE = 'http://127.0.0.1:8100'

function resolveApiBase(): string {
  const candidates = [
    process.env.API_INTERNAL_URL,
    process.env.CACHEFLOW_API_INTERNAL_URL,
    process.env.API_URL,
    DEFAULT_API_BASE,
    process.env.NEXT_PUBLIC_API_URL,
    'http://localhost:8100',
  ].filter(Boolean) as string[]

  const nonLoopback = candidates.find((u) => {
    try {
      const h = new URL(u).hostname
      return h !== '127.0.0.1' && h !== 'localhost'
    } catch {
      return false
    }
  })

  return (nonLoopback ?? candidates[0] ?? DEFAULT_API_BASE).replace(/\/+$/, '')
}

async function extractUserId(request: NextRequest): Promise<string | null> {
  const cookieStore = await cookies()
  const tokenFromCookie = cookieStore.get('accessToken')?.value
  const authHeader = request.headers.get('authorization')
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const token = tokenFromCookie ?? tokenFromHeader

  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET
    if (!secret) return null
    const decoded = jwt.verify(token, secret) as JwtPayload
    return decoded.id ?? null
  } catch {
    return null
  }
}

async function fetchRemotes(request: NextRequest): Promise<BackendRemote[]> {
  const apiBase = resolveApiBase()
  const cookieStore = await cookies()
  const tokenFromCookie = cookieStore.get('accessToken')?.value
  const authHeader = request.headers.get('authorization') ?? (tokenFromCookie ? `Bearer ${tokenFromCookie}` : null)
  const cookieHeader = request.headers.get('cookie')

  const res = await fetch(`${apiBase}/api/remotes`, {
    headers: {
      ...(authHeader && { Authorization: authHeader }),
      ...(cookieHeader && { Cookie: cookieHeader }),
    },
    cache: 'no-store',
  })

  if (!res.ok) return []

  const payload = await res.json()
  const raw = payload?.data?.remotes ?? payload?.remotes ?? payload?.data ?? []
  return Array.isArray(raw) ? raw : []
}

async function probeRemoteViaExpressProxy(
  remoteId: string,
  provider: string,
  probeUrl: string,
  probeMethod: string,
  probeBody: string | undefined,
  request: NextRequest,
): Promise<number> {
  const apiBase = resolveApiBase()
  const cookieStore = await cookies()
  const tokenFromCookie = cookieStore.get('accessToken')?.value
  const authHeader = request.headers.get('authorization') ?? (tokenFromCookie ? `Bearer ${tokenFromCookie}` : null)
  const cookieHeader = request.headers.get('cookie')

  const res = await fetch(`${apiBase}/api/remotes/${remoteId}/proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader && { Authorization: authHeader }),
      ...(cookieHeader && { Cookie: cookieHeader }),
    },
    body: JSON.stringify({
      method: probeMethod,
      url: probeUrl,
      body: probeBody !== undefined ? JSON.parse(probeBody) : undefined,
    }),
    cache: 'no-store',
  })

  return res.status
}

const PROBE_URLS: Record<string, { url: string; method?: string; body?: string }> = {
  google: { url: 'https://www.googleapis.com/drive/v3/about?fields=user%28emailAddress%29' },
  onedrive: { url: 'https://graph.microsoft.com/v1.0/me?$select=userPrincipalName' },
  dropbox: {
    url: 'https://api.dropboxapi.com/2/users/get_current_account',
    method: 'POST',
    body: 'null',
  },
  box: { url: 'https://api.box.com/2.0/users/me?fields=id,login' },
  pcloud: { url: 'https://api.pcloud.com/userinfo' },
  yandex: { url: 'https://login.yandex.ru/info' },
}

function httpStatusToProbe(httpStatus: number, checkedAt: string, latencyMs: number): HealthProbeResult {
  if (httpStatus >= 200 && httpStatus < 300) {
    return { status: 'healthy', checkedAt, httpStatus, message: 'Provider reachable and credentials valid', latencyMs }
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return {
      status: 'needs_reauth', checkedAt, httpStatus,
      message: httpStatus === 401 ? 'Token invalid or expired' : 'Token lacks required permissions',
      latencyMs,
    }
  }
  return {
    status: 'degraded', checkedAt, httpStatus,
    message: httpStatus === 429 ? 'Provider is rate-limiting this account' : `HTTP ${httpStatus} from provider`,
    latencyMs,
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<HealthResponse | { success: false; error: string }>> {
  const userId = await extractUserId(request)
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const checkedAt = new Date().toISOString()

  let remotes: BackendRemote[]
  try {
    remotes = await fetchRemotes(request)
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch connections' }, { status: 502 })
  }

  const probeResults = await Promise.all(
    remotes.map(async (remote): Promise<ConnectionHealth> => {
      const displayName = remote.display_name ?? remote.account_email ?? remote.account_key ?? remote.id
      const disabled = remote.disabled ?? false

      if (disabled) {
        return {
          id: remote.id,
          provider: remote.provider,
          displayName,
          disabled: true,
          probe: {
            status: 'needs_reauth',
            checkedAt,
            message: 'Connection is disabled',
            latencyMs: 0,
          },
        }
      }

      const probeConfig = PROBE_URLS[remote.provider]
      if (!probeConfig) {
        return {
          id: remote.id,
          provider: remote.provider,
          displayName,
          disabled: false,
          probe: await probeProvider(remote.provider, ''),
        }
      }

      const startMs = Date.now()
      let probe: HealthProbeResult
      try {
        const httpStatus = await probeRemoteViaExpressProxy(
          remote.id,
          remote.provider,
          probeConfig.url,
          probeConfig.method ?? 'GET',
          probeConfig.body,
          request,
        )
        probe = httpStatusToProbe(httpStatus, checkedAt, Date.now() - startMs)
      } catch {
        probe = {
          status: 'degraded',
          checkedAt,
          message: 'Failed to reach provider via proxy',
          latencyMs: Date.now() - startMs,
        }
      }

      return { id: remote.id, provider: remote.provider, displayName, disabled: false, probe }
    }),
  )

  return NextResponse.json({
    success: true,
    checkedAt,
    connections: probeResults,
  })
}
