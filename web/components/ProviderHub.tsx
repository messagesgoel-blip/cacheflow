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
  lastTestedAt?: string
  lastHostFingerprint?: string
}

type FingerprintDriftState = {
  previousFingerprint: string
  currentFingerprint: string
}

const STATUS_CHIP: Record<ServerConnection['status'], string> = {
  connected: 'border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.12)] text-[var(--cf-green)]',
  disconnected: 'border border-[var(--cf-border)] bg-[rgba(255,255,255,0.04)] text-[var(--cf-text-1)]',
  error: 'border border-[rgba(255,92,92,0.28)] bg-[rgba(255,92,92,0.08)] text-[var(--cf-red)]',
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
  const [fingerprintDriftByConnection, setFingerprintDriftByConnection] = useState<Record<string, FingerprintDriftState>>({})

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
      const nextConnections = Array.isArray(payload.data) ? payload.data : []
      setConnections(nextConnections)
      setFingerprintDriftByConnection((prev) => {
        const next: Record<string, FingerprintDriftState> = {}
        for (const connection of nextConnections) {
          if (prev[connection.id]) next[connection.id] = prev[connection.id]
        }
        return next
      })
      setTestedVpsIds(
        new Set(
          nextConnections
            .filter((connection: ServerConnection) => connection.provider === 'vps' && connection.lastTestedAt)
            .map((connection: ServerConnection) => connection.id),
        ),
      )
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
    window.addEventListener('cacheflow:vps-updated', handler as EventListener)
    window.addEventListener('cacheflow:vps-tested', handler as EventListener)
    return () => {
      window.removeEventListener('cacheflow:vps-connected', handler as EventListener)
      window.removeEventListener('cacheflow:vps-updated', handler as EventListener)
      window.removeEventListener('cacheflow:vps-tested', handler as EventListener)
    }
  }, [fetchConnections])

  useEffect(() => {
    const handleRemoteConnected = () => {
      void fetchConnections()
    }

    window.addEventListener('cacheflow:remote-connected', handleRemoteConnected)
    return () => {
      window.removeEventListener('cacheflow:remote-connected', handleRemoteConnected)
    }
  }, [fetchConnections])

  useEffect(() => {
    const handleCloudConnect = () => openConnectModal('google')
    const handleVpsConnect = () => openConnectModal('vps')

    window.addEventListener('cacheflow:command-connect-cloud', handleCloudConnect)
    window.addEventListener('cacheflow:command-connect-vps', handleVpsConnect)

    return () => {
      window.removeEventListener('cacheflow:command-connect-cloud', handleCloudConnect)
      window.removeEventListener('cacheflow:command-connect-vps', handleVpsConnect)
    }
  }, [openConnectModal])

  const availableToConnect = useMemo(() => CONNECTABLE_PROVIDERS, [])
  const cloudConnections = useMemo(
    () => connections.filter((connection) => connection.provider !== 'vps'),
    [connections],
  )
  const vpsConnections = useMemo(
    () => connections.filter((connection) => connection.provider === 'vps'),
    [connections],
  )
  const availableCloudProviders = useMemo(
    () => availableToConnect.filter((provider) => provider.id !== 'vps'),
    [availableToConnect],
  )
  const availableServerProviders = useMemo(
    () => availableToConnect.filter((provider) => provider.id === 'vps'),
    [availableToConnect],
  )
  const connectedCount = connections.length
  const vpsCount = connections.filter((connection) => connection.provider === 'vps').length
  const activeCount = connections.filter((connection) => connection.status === 'connected').length
  const cloudCount = connections.filter((connection) => connection.provider !== 'vps').length
  const summaryCards = [
    {
      label: 'Connected',
      value: connectedCount.toString(),
      helper: `${activeCount} active sessions`,
      detail: `${Math.max(connectedCount - activeCount, 0)} inactive or degraded`,
      accent: 'text-[var(--cf-blue)]',
    },
    {
      label: 'VPS Nodes',
      value: vpsCount.toString(),
      helper: `${Math.max(cloudCount, 0)} cloud remotes`,
      detail: 'Server-side endpoints with direct verification',
      accent: 'text-[var(--cf-teal)]',
    },
    {
      label: 'Protocols',
      value: String(new Set(connections.map((connection) => connection.provider === 'vps' ? 'sftp' : 'oauth')).size || 1),
      helper: 'OAuth + SFTP control plane',
      detail: 'No additional client storage paths introduced',
      accent: 'text-[var(--cf-amber)]',
    },
    {
      label: 'Connectable',
      value: availableToConnect.length.toString(),
      helper: 'Available from this shell',
      detail: `${availableCloudProviders.length} cloud, ${availableServerProviders.length} server`,
      accent: 'text-[var(--cf-purple)]',
    },
  ]

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

  const handleTestVps = useCallback(
    async (connection: ServerConnection) => {
      try {
        const response = await fetch(`/api/providers/vps/${connection.id}/test`, {
          method: 'POST',
          credentials: 'include',
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.detail || payload?.error || 'Connection test failed')
        }

        const previousHostFingerprint =
          typeof payload?.previousHostFingerprint === 'string'
            ? payload.previousHostFingerprint
            : connection.lastHostFingerprint || ''
        const nextHostFingerprint =
          typeof payload?.hostFingerprint === 'string'
            ? payload.hostFingerprint
            : ''
        const fingerprintChanged = detectFingerprintDrift(previousHostFingerprint, nextHostFingerprint, payload?.fingerprintChanged)

        setTestedVpsIds((prev) => {
          const next = new Set(prev)
          next.add(connection.id)
          return next
        })

        if (fingerprintChanged && previousHostFingerprint && nextHostFingerprint) {
          setFingerprintDriftByConnection((prev) => ({
            ...prev,
            [connection.id]: {
              previousFingerprint: previousHostFingerprint,
              currentFingerprint: nextHostFingerprint,
            },
          }))
          actions.notify({
            kind: 'warning',
            title: 'Host fingerprint changed',
            message: `${connection.accountLabel || connection.accountName} returned a different SSH fingerprint. Verify host identity before trusting the new key.`,
          })
        } else {
          setFingerprintDriftByConnection((prev) => {
            if (!prev[connection.id]) return prev
            const next = { ...prev }
            delete next[connection.id]
            return next
          })
          actions.notify({
            kind: 'success',
            title: 'Connection tested',
            message: nextHostFingerprint
              ? `${connection.accountLabel || connection.accountName} verified • ${shortFingerprint(nextHostFingerprint)}`
              : `${connection.accountLabel || connection.accountName} is reachable`,
          })
        }
        void fetchConnections()
      } catch (err: any) {
        actions.notify({
          kind: 'error',
          title: 'Connection test failed',
          message: err?.message || 'Could not reach VPS',
        })
      }
    },
    [actions, fetchConnections],
  )

  return (
    <div className="mx-auto max-w-[1600px] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="cf-kicker mb-2">Providers</div>
          <h1 className="mb-2 text-[28px] font-semibold leading-tight text-[var(--cf-text-0)]">Connected Providers</h1>
          <p className="text-sm text-[var(--cf-text-1)]">
            Operational view for real connected providers, verification state, and stored remote endpoints.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openConnectModal('google')}
            className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.04)] px-3.5 py-2 text-sm font-medium text-[var(--cf-text-0)] hover:bg-[rgba(255,255,255,0.08)]"
          >
            Add Cloud Provider
          </button>
          <button
            type="button"
            onClick={() => openConnectModal('vps')}
            className="rounded-2xl border border-[rgba(255,159,67,0.22)] bg-[rgba(255,159,67,0.1)] px-3.5 py-2 text-sm font-medium text-[var(--cf-amber)] hover:bg-[rgba(255,159,67,0.16)]"
          >
            Connect VPS / SFTP
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-[28px] border border-[var(--cf-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="cf-kicker">Operational Summary</div>
            <h2 className="mt-2 text-lg font-semibold text-[var(--cf-text-0)]">Control plane connectivity</h2>
            <p className="mt-1.5 text-sm text-[var(--cf-text-1)]">High-signal split between live remotes, server nodes, and available connection paths.</p>
          </div>
          <div className="rounded-full border border-[var(--cf-border)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-[12px] text-[var(--cf-text-2)]">
            {activeCount}/{Math.max(connectedCount, 1)} active sessions
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cf-text-2)]">
              {card.label}
            </div>
            <div className={`text-[26px] font-semibold leading-none ${card.accent}`}>{card.value}</div>
            <div className="mt-2 text-sm text-[var(--cf-text-2)]">{card.helper}</div>
            <div className="mt-1 text-xs text-[var(--cf-text-3)]">{card.detail}</div>
          </div>
        ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-[rgba(255,92,92,0.28)] bg-[rgba(255,92,92,0.08)] px-4 py-3 text-sm text-[var(--cf-red)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--cf-blue)]" />
        </div>
      ) : (
        <>
          {connections.length === 0 ? (
            <div className="cf-panel mb-8 rounded-2xl p-6 text-sm text-[var(--cf-text-1)]">
              No connected providers. Use the connect cards below to add your first provider.
            </div>
          ) : (
            <div className="mb-10 space-y-8">
              {[
                {
                  key: 'cloud',
                  title: 'Cloud Remotes',
                  description: 'OAuth-backed storage providers currently available in this workspace.',
                  connections: cloudConnections,
                  testId: 'cf-provider-section-cloud',
                },
                {
                  key: 'vps',
                  title: 'VPS / SFTP Nodes',
                  description: 'Server-side remotes with host verification and direct browser actions.',
                  connections: vpsConnections,
                  testId: 'cf-provider-section-vps',
                },
              ].map((section) => (
                section.connections.length > 0 ? (
                  <section key={section.key} data-testid={section.testId}>
                    <div className="mb-4 flex items-end justify-between gap-3 border-b border-[var(--cf-border)] pb-3">
                      <div>
                        <div className="cf-kicker mb-1">{section.key === 'cloud' ? 'Cloud' : 'Server Nodes'}</div>
                        <h2 className="text-[20px] font-semibold leading-tight text-[var(--cf-text-0)]">{section.title}</h2>
                        <p className="mt-1 text-sm text-[var(--cf-text-1)]">{section.description}</p>
                      </div>
                      <div className="rounded-full border border-[var(--cf-border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs text-[var(--cf-text-2)]">
                        {section.connections.length} connected
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {section.connections.map((connection) => {
                        const fingerprintDrift = fingerprintDriftByConnection[connection.id]
                        return (
                          <div
                            key={`${connection.provider}:${connection.id}`}
                            data-testid={`cf-provider-card-${connection.id}`}
                            className="cf-panel relative overflow-hidden rounded-[24px] p-5 transition-all hover:-translate-y-0.5"
                          >
                            <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(74,158,255,0.6),transparent)]" />
                            <div className="mb-4 flex items-start gap-3">
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.04)] text-2xl">
                                {getProviderIcon(connection.provider as ProviderId)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-[var(--cf-text-0)]">
                                    {connection.accountLabel || connection.accountName}
                                  </p>
                                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${STATUS_CHIP[connection.status]}`}>
                                    {connection.status === 'error' ? 'Auth Error' : connection.status}
                                  </span>
                                </div>
                                <p className="truncate text-xs text-[var(--cf-text-2)]">
                                  {displayProviderName(connection.provider)}
                                </p>
                              </div>
                            </div>

                            <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
                                <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-3)]">
                                  Auth
                                </div>
                                <div className="text-[var(--cf-text-1)]">
                                  {connection.provider === 'vps' ? 'PEM / SFTP' : 'OAuth remote'}
                                </div>
                              </div>
                              <div className="rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
                                <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-3)]">
                                  Last Sync
                                </div>
                                <div className="text-[var(--cf-text-1)]">
                                  {connection.lastSyncAt ? formatCompactDate(connection.lastSyncAt) : 'No sync yet'}
                                </div>
                              </div>
                            </div>

                            {connection.provider === 'vps' ? (
                              <div className="mb-4 space-y-2 rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-3 text-xs text-[var(--cf-text-1)]">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="truncate">Host: {maskHost(connection.host || '')}</span>
                                  <span className="rounded-full border border-[rgba(74,158,255,0.24)] bg-[rgba(74,158,255,0.1)] px-2 py-0.5 text-[10px] font-semibold text-[var(--cf-blue)]">
                                    SFTP :{connection.port || 22}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span>User: {connection.username || 'Unknown'}</span>
                                  <span className="flex items-center gap-1 text-[11px] text-[var(--cf-text-2)]">
                                    <span className={`h-2 w-2 rounded-full ${testedVpsIds.has(connection.id) ? 'bg-[var(--cf-green)]' : 'bg-[var(--cf-text-3)]'}`} />
                                    {testedVpsIds.has(connection.id) ? 'Tested' : 'Untested'}
                                  </span>
                                </div>
                                {connection.lastTestedAt ? (
                                  <div className="rounded-lg border border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.08)] p-2">
                                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-3)]">
                                      Last Verified
                                    </div>
                                    <div className="mt-1 text-[11px] text-[var(--cf-text-1)]">
                                      {formatCompactDate(connection.lastTestedAt)}
                                    </div>
                                    {connection.lastHostFingerprint ? (
                                      <div className="mt-1 break-all font-mono text-[10px] text-[var(--cf-green)]" title={connection.lastHostFingerprint}>
                                        {shortFingerprint(connection.lastHostFingerprint)}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                                {fingerprintDrift ? (
                                  <div className="rounded-lg border border-[rgba(255,159,67,0.28)] bg-[rgba(255,159,67,0.1)] p-2">
                                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-amber)]">
                                      Fingerprint Changed
                                    </div>
                                    <div className="mt-1 text-[11px] text-[var(--cf-text-1)]">
                                      Previous host key and current test result do not match.
                                    </div>
                                    <div className="mt-2 break-all font-mono text-[10px] text-[var(--cf-text-2)]">
                                      Was: {shortFingerprint(fingerprintDrift.previousFingerprint)}
                                    </div>
                                    <div className="mt-1 break-all font-mono text-[10px] text-[var(--cf-amber)]">
                                      Now: {shortFingerprint(fingerprintDrift.currentFingerprint)}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="mb-4 rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-xs text-[var(--cf-text-1)]">
                                <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-3)]">
                                  Account
                                </div>
                                <div className="truncate text-[var(--cf-text-1)]">
                                  {connection.accountEmail || connection.accountName || 'No email provided'}
                                </div>
                              </div>
                            )}

                            {confirmDisconnectId === connection.id ? (
                              <div className="space-y-3 rounded-xl border border-[rgba(255,92,92,0.28)] bg-[rgba(255,92,92,0.08)] p-3">
                                <p className="text-xs text-[var(--cf-red)]">
                                  Disconnect {displayProviderName(connection.provider)}? This will remove all stored credentials.
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDisconnectId(null)}
                                    className="flex-1 rounded-lg border border-[var(--cf-border)] px-2 py-1.5 text-xs font-medium text-[var(--cf-text-1)] hover:bg-[rgba(255,255,255,0.04)]"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDisconnect(connection)}
                                    disabled={disconnectingId === connection.id}
                                    className="flex-1 rounded-lg bg-[var(--cf-red)] px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                  >
                                    {disconnectingId === connection.id ? 'Disconnecting…' : 'Disconnect'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="grid gap-2 sm:grid-cols-2">
                                {connection.provider === 'vps' ? (
                                  <>
                                    <button
                                      type="button"
                                      data-testid={`cf-provider-open-${connection.id}`}
                                      onClick={() => {
                                        window.location.href = `/providers/vps/${connection.id}`
                                      }}
                                      className="rounded-2xl border border-[rgba(74,158,255,0.24)] bg-[rgba(74,158,255,0.12)] px-3 py-2 text-sm font-medium text-[var(--cf-blue)] hover:bg-[rgba(74,158,255,0.18)]"
                                    >
                                      Open Files
                                    </button>
                                    <button
                                      type="button"
                                      data-testid={`cf-provider-test-${connection.id}`}
                                      onClick={() => void handleTestVps(connection)}
                                      className="rounded-2xl border border-[rgba(16,185,129,0.22)] bg-[rgba(16,185,129,0.1)] px-3 py-2 text-sm font-medium text-[var(--cf-green)] hover:bg-[rgba(16,185,129,0.16)]"
                                    >
                                      Test Connection
                                    </button>
                                    <button
                                      type="button"
                                      data-testid={`cf-provider-edit-${connection.id}`}
                                      onClick={() =>
                                        openConnectModal('vps', {
                                          mode: 'edit',
                                          connection,
                                        })
                                      }
                                      className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm font-medium text-[var(--cf-text-1)] hover:bg-[rgba(255,255,255,0.06)]"
                                    >
                                      Edit Details
                                    </button>
                                  </>
                                ) : (
                                  <div className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-left text-sm text-[var(--cf-text-1)]">
                                    <div className="font-medium text-[var(--cf-text-0)]">Provider Ready</div>
                                    <div className="mt-1 text-xs text-[var(--cf-text-2)]">OAuth remote is connected and available for browsing flows.</div>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  data-testid={`cf-provider-disconnect-${connection.id}`}
                                  onClick={() => setConfirmDisconnectId(connection.id)}
                                  className="rounded-2xl border border-[rgba(255,92,92,0.24)] bg-[rgba(255,92,92,0.08)] px-3 py-2 text-sm font-medium text-[var(--cf-red)] hover:bg-[rgba(255,92,92,0.12)]"
                                >
                                  Disconnect
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ) : null
              ))}
            </div>
          )}

          <div className="space-y-8">
            <div className="mb-4">
              <div className="cf-kicker mb-2">Connect</div>
              <h2 className="text-[28px] font-semibold leading-tight text-[var(--cf-text-0)]">Available Integrations</h2>
              <p className="mt-2 text-sm text-[var(--cf-text-1)]">
                Add another provider or server-side remote without leaving the current control plane.
              </p>
            </div>
            
            {[
              {
                key: 'cloud-connect',
                title: 'Cloud Providers',
                description: 'OAuth-backed storage accounts currently available for integration.',
                providers: availableCloudProviders,
              },
              {
                key: 'server-connect',
                title: 'Server-side Remotes',
                description: 'Direct VPS and SFTP remotes that share the same shell context.',
                providers: availableServerProviders,
              },
              ].map((group) => (
              group.providers.length > 0 ? (
                <section key={group.key} className="rounded-[28px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.02)] p-6">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--cf-border)] pb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-[var(--cf-text-0)]">{group.title}</h3>
                      <p className="mt-1.5 text-sm text-[var(--cf-text-1)]">{group.description}</p>
                    </div>
                    <div className="rounded-full border border-[var(--cf-border)] bg-[rgba(255,255,255,0.04)] px-3 py-1 text-xs text-[var(--cf-text-2)]">
                      {group.providers.length} available
                    </div>
                  </div>
                  <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {group.providers.map((provider) => (
                      <div
                        key={provider.id}
                        data-testid={`cf-provider-connect-card-${provider.id}`}
                        className="flex h-full flex-col rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-5 transition-all hover:-translate-y-0.5"
                      >
                        <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cf-text-3)]">
                          {provider.id === 'vps' ? 'Server-side remote' : 'OAuth provider'}
                        </div>
                        <div className="mb-4 flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--cf-border)] text-[22px]" style={{ backgroundColor: `${provider.color}22` }}>
                            {getProviderIcon(provider.id)}
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-[var(--cf-text-0)]">{provider.name}</p>
                            <p className="text-[11px] leading-relaxed text-[var(--cf-text-2)]">{provider.description}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openConnectModal(provider.id)}
                          className={`mt-auto w-full rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${
                            provider.id === 'vps'
                              ? 'border-[rgba(255,159,67,0.22)] bg-[rgba(255,159,67,0.1)] text-[var(--cf-amber)] hover:bg-[rgba(255,159,67,0.16)]'
                              : 'border-[var(--cf-border)] bg-[rgba(255,255,255,0.04)] text-[var(--cf-text-0)] hover:bg-[rgba(255,255,255,0.08)]'
                          }`}
                        >
                          Connect
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null
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

function shortFingerprint(fingerprint: string): string {
  const value = fingerprint.trim()
  if (value.length <= 28) return value
  return `${value.slice(0, 20)}…${value.slice(-8)}`
}

export function detectFingerprintDrift(
  previousFingerprint?: string | null,
  currentFingerprint?: string | null,
  explicitChanged?: boolean,
): boolean {
  if (explicitChanged) return true
  if (!previousFingerprint || !currentFingerprint) return false
  return previousFingerprint !== currentFingerprint
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

function formatCompactDate(value: string): string {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
