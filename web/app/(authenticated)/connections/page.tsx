'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ProviderId, ConnectedProvider } from '@/lib/providers/types'
import '@/styles/layout.css'

interface ServerConnection {
  id: string
  provider: string
  accountKey: string
  remoteId: string
  accountName: string
  accountEmail: string
  accountLabel: string
  isDefault: boolean
  status: 'connected' | 'disconnected' | 'error'
  lastSyncAt?: string
  host?: string
  port?: number
  username?: string
}

interface SessionResponse {
  authenticated?: boolean
  user?: {
    email?: string
  }
}

function toConnectedProvider(conn: ServerConnection): ConnectedProvider {
  return {
    providerId: conn.provider as ProviderId,
    status: conn.status === 'disconnected' ? 'needs_reauth' : conn.status,
    accountEmail: conn.accountEmail,
    displayName: conn.accountLabel || conn.accountName,
    accountKey: conn.accountKey,
    host: conn.host,
    port: conn.port,
    username: conn.username,
    connectedAt: conn.lastSyncAt ? new Date(conn.lastSyncAt).getTime() : Date.now(),
    lastSyncedAt: conn.lastSyncAt ? new Date(conn.lastSyncAt).getTime() : undefined,
  }
}

const STATUS_LABEL: Record<string, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Auth Error',
}

const STATUS_COLOR: Record<string, string> = {
  connected: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  disconnected: 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800',
  error: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
}

export default function ConnectionsPage() {
  const router = useRouter()
  const [connections, setConnections] = useState<ServerConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | 'all' | 'recent' | 'starred' | 'activity'>('all')
  const [activeAccountKey, setActiveAccountKey] = useState('')

  const fetchConnections = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/connections', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login?reason=session_expired')
          return
        }
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Failed to load connections. Try refreshing.')
        setLoading(false)
        return
      }
      const body = await res.json()
      setConnections(body.data ?? [])
    } catch {
      setError('Network error — could not reach server. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  const handleNavigate = (
    providerId: ProviderId | 'all' | 'vault' | 'recent' | 'starred' | 'activity',
    accountKey?: string
  ) => {
    setSelectedProvider(providerId === 'vault' ? 'all' : providerId)
    if (accountKey) setActiveAccountKey(accountKey)
  }

  const connectedProviders: ConnectedProvider[] = connections
    .filter((c) => c.status === 'connected')
    .map(toConnectedProvider)

  return (
    <div className="flex flex-col">
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 pb-10 md:p-6 md:pb-10">
          <div className="mx-auto max-w-[1280px]">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="cf-kicker mb-3">Your Drives</div>
                <h1 className="text-3xl font-semibold text-[var(--cf-text-0)]">Connections</h1>
                <p className="mt-2 text-sm text-[var(--cf-text-1)]">
                  All provider connections currently known to the server control plane.
                </p>
              </div>
              <button
                onClick={() => fetchConnections()}
                disabled={loading}
                className="rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-bg)] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-1)] transition-colors hover:text-[var(--cf-text-0)] disabled:opacity-50"
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {error && (
              <div
                data-testid="cf-connections-error"
                className="mb-4 rounded-2xl border border-[rgba(255,92,92,0.28)] bg-[rgba(255,92,92,0.08)] p-4 text-sm text-[var(--cf-red)]"
              >
                {error}
              </div>
            )}

            {loading && connections.length === 0 ? (
              <div data-testid="cf-connections-loading" className="cf-panel rounded-[24px] py-12 text-center text-[var(--cf-text-2)]">
                Loading connections…
              </div>
            ) : connections.length === 0 && !error ? (
              <div
                data-testid="cf-connections-empty"
                className="cf-panel rounded-[24px] py-12 text-center"
              >
                <p className="mb-3 text-[var(--cf-text-1)]">No provider connections found</p>
                <Link
                  href="/providers"
                  className="text-sm text-[var(--cf-blue)] hover:underline"
                >
                  Add your first provider →
                </Link>
              </div>
            ) : (
              <div
                data-testid="cf-connections-list"
                className="grid grid-cols-1 gap-3 md:grid-cols-2"
              >
                {connections.map((conn) => (
                  <div
                    key={`${conn.provider}:${conn.accountKey}`}
                    data-testid={`cf-connection-item-${conn.accountKey}`}
                    className="cf-panel flex min-h-[80px] rounded-[24px] p-5"
                  >
                    <div className="grid w-full gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] sm:items-center">
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[var(--cf-text-0)]">
                          {conn.accountLabel || conn.accountName}
                        </span>
                      </div>
                      <div className="min-w-0">
                        {(conn.provider === 'vps' ? (conn.username && conn.host ? `${conn.username}@${conn.host}` : conn.host || conn.username || '') : conn.accountEmail) ? (
                          <span className="block truncate text-xs text-[var(--cf-text-2)]">
                            {conn.provider === 'vps'
                              ? (conn.username && conn.host ? `${conn.username}@${conn.host}` : conn.host || conn.username)
                              : conn.accountEmail}
                          </span>
                        ) : (
                          <span className="block truncate text-xs italic text-[var(--cf-text-3)]">
                            No account metadata
                          </span>
                        )}
                      </div>
                      <span className="text-xs capitalize text-[var(--cf-text-3)]">
                        {conn.provider}
                      </span>
                      <span
                        className={`justify-self-start rounded-full px-2.5 py-1 text-xs font-medium sm:justify-self-end ${STATUS_COLOR[conn.status] ?? STATUS_COLOR.disconnected}`}
                      >
                        {STATUS_LABEL[conn.status] ?? conn.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
