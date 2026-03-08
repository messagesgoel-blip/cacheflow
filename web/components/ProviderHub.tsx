'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ProviderId, PROVIDERS } from '@/lib/providers/types'
import { useActionCenter } from '@/components/ActionCenterProvider'
import { useIntegration } from '@/context/IntegrationContext'

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

const STATUS_CHIP: Record<ServerConnection['status'], string> = {
  connected: 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/40',
  disconnected: 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-700/50',
  error: 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40',
}

const CONNECTABLE_PROVIDERS = PROVIDERS.filter((provider) => provider.id !== 'local')

export default function ProviderHub() {
  const { openConnectModal } = useIntegration()
  const actions = useActionCenter()
  const [connections, setConnections] = useState<ServerConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDisconnectId, setConfirmDisconnectId] = useState<string | null>(null)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [testedVpsIds, setTestedVpsIds] = useState<Set<string>>(new Set())

  const fetchConnections = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/connections', {
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.error || 'Failed to load provider connections')
        setConnections([])
        return
      }
      const payload = await response.json()
      setConnections(Array.isArray(payload.data) ? payload.data : [])
    } catch {
      setError('Failed to load provider connections')
      setConnections([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchConnections()
  }, [fetchConnections])

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>
      const id = customEvent.detail?.id
      if (!id) return
      setTestedVpsIds((prev) => {
        const next = new Set(prev)
        next.add(id)
        return next
      })
      void fetchConnections()
    }
    window.addEventListener('cacheflow:vps-connected', handler as EventListener)
    return () => {
      window.removeEventListener('cacheflow:vps-connected', handler as EventListener)
    }
  }, [fetchConnections])

  const availableToConnect = useMemo(() => CONNECTABLE_PROVIDERS, [])

  const handleDisconnect = useCallback(
    async (connection: ServerConnection) => {
      const removed = connection
      setDisconnectingId(removed.id)
      setConfirmDisconnectId(null)
      setConnections((prev) => prev.filter((item) => item.id !== removed.id))

      const endpoint = removed.provider === 'vps'
        ? `/api/providers/vps/${removed.id}`
        : `/api/providers/${removed.id}`

      try {
        const response = await fetch(endpoint, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.error || 'Disconnect failed')
        }

        actions.notify({
          kind: 'success',
          title: 'Disconnected',
          message: `${displayProviderName(removed.provider)} connection removed`,
        })
      } catch (err: any) {
        setConnections((prev) => [removed, ...prev])
        actions.notify({
          kind: 'error',
          title: 'Disconnect failed',
          message: err?.message || 'Could not disconnect provider',
        })
      } finally {
        setDisconnectingId(null)
      }
    },
    [actions]
  )

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Provider Connections</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage real connected providers and remove stored credentials when needed.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
        </div>
      ) : (
        <>
          {connections.length === 0 ? (
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              No connected providers. Use the connect cards below to add your first provider.
            </div>
          ) : (
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {connections.map((connection) => (
                <div
                  key={`${connection.provider}:${connection.id}`}
                  data-testid={`cf-provider-card-${connection.id}`}
                  className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-blue-900/30 dark:bg-gray-800"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-2xl dark:bg-blue-900/30">
                      {getProviderIcon(connection.provider as ProviderId)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {connection.accountLabel || connection.accountName}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {displayProviderName(connection.provider)}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${STATUS_CHIP[connection.status]}`}>
                      {connection.status === 'error' ? 'Auth Error' : connection.status}
                    </span>
                  </div>

                  {connection.accountEmail && (
                    <p className="mb-3 truncate text-xs text-gray-500 dark:text-gray-400">
                      {connection.accountEmail}
                    </p>
                  )}

                  {connection.provider === 'vps' && (
                    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
                      <div className="flex items-center justify-between">
                        <span>Host: {maskHost(connection.host || '')}</span>
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold dark:bg-gray-700">
                          SFTP · :{connection.port || 22}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className={`h-2 w-2 rounded-full ${testedVpsIds.has(connection.id) ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span>{testedVpsIds.has(connection.id) ? 'Connection tested' : 'Untested since startup'}</span>
                      </div>
                    </div>
                  )}

                  {confirmDisconnectId === connection.id ? (
                    <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/40 dark:bg-red-900/20">
                      <p className="text-xs text-red-700 dark:text-red-300">
                        Disconnect {displayProviderName(connection.provider)}? This will remove all stored credentials.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDisconnectId(null)}
                          className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDisconnect(connection)}
                          disabled={disconnectingId === connection.id}
                          className="flex-1 rounded-md bg-red-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {disconnectingId === connection.id ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {connection.provider === 'vps' && (
                        <button
                          type="button"
                          data-testid={`cf-provider-open-${connection.id}`}
                          onClick={() => {
                            window.location.href = `/providers/vps/${connection.id}`
                          }}
                          className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                        >
                          Open Files
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid={`cf-provider-disconnect-${connection.id}`}
                        onClick={() => setConfirmDisconnectId(connection.id)}
                        className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                      >
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Connect Provider
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableToConnect.map((provider) => (
              <div
                key={provider.id}
                data-testid={`cf-provider-connect-card-${provider.id}`}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg text-2xl" style={{ backgroundColor: `${provider.color}22` }}>
                    {getProviderIcon(provider.id)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{provider.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{provider.description}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openConnectModal(provider.id)}
                  className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Connect
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function displayProviderName(provider: string): string {
  return PROVIDERS.find((item) => item.id === provider)?.name || provider
}

const providerIconMap: Record<ProviderId, string> = {
  google: '🗂️',
  onedrive: '☁️',
  dropbox: '📦',
  box: '📁',
  pcloud: '🧊',
  filen: '🔒',
  yandex: '📀',
  webdav: '🌐',
  vps: '🖥️',
  local: '💻',
}

function getProviderIcon(providerId: ProviderId): string {
  return providerIconMap[providerId] || '📁'
}

function maskHost(host: string): string {
  const ipv4 = host.match(/^(\d+\.\d+\.\d+)\.\d+$/)
  if (ipv4) return `${ipv4[1]}.●●●`
  if (!host) return '●●●'
  const dotIndex = host.lastIndexOf('.')
  if (dotIndex <= 0) return '●●●'
  return `${host.slice(0, dotIndex)}.●●●`
}

