'use client'

import { useState, useEffect, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import Sidebar from '@/components/Sidebar'
import SidebarNav from '@/components/Sidebar/SidebarNav'
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
}

function toConnectedProvider(conn: ServerConnection): ConnectedProvider {
  return {
    providerId: conn.provider as ProviderId,
    status: conn.status === 'disconnected' ? 'needs_reauth' : conn.status,
    accountEmail: conn.accountEmail,
    displayName: conn.accountLabel || conn.accountName,
    accountKey: conn.accountKey,
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
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [connections, setConnections] = useState<ServerConnection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | 'all' | 'recent' | 'starred' | 'activity'>('all')
  const [activeAccountKey, setActiveAccountKey] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem('cf_token')
    const e = localStorage.getItem('cf_email')
    if (t && e) {
      setToken(t)
      setEmail(e)
    }
  }, [])

  const fetchConnections = useCallback(async (t: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/connections', {
        headers: { Authorization: `Bearer ${t}` },
        cache: 'no-store',
      })
      const body = await res.json()
      if (!body.success) {
        setError(body.error || 'Failed to load connections')
        return
      }
      setConnections(body.data ?? [])
    } catch (err) {
      setError('Network error — could not reach server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (token) {
      fetchConnections(token)
    }
  }, [token, fetchConnections])

  const handleNavigate = (
    providerId: ProviderId | 'all' | 'recent' | 'starred' | 'activity',
    accountKey?: string
  ) => {
    setSelectedProvider(providerId)
    if (accountKey) setActiveAccountKey(accountKey)
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Please log in to view your connections</p>
          <a
            href="/login"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Log In
          </a>
        </div>
      </div>
    )
  }

  const connectedProviders: ConnectedProvider[] = connections
    .filter((c) => c.status === 'connected')
    .map(toConnectedProvider)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Navbar
        email={email}
        onLogout={() => {
          localStorage.removeItem('cf_token')
          localStorage.removeItem('cf_email')
          window.location.href = '/login'
        }}
      />

      {/* Mobile menu button */}
      <button
        className="show-mobile-only fixed top-16 left-4 z-30 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile sidebar */}
      <SidebarNav
        connectedProviders={connectedProviders}
        selectedProvider={selectedProvider}
        activeAccountKey={activeAccountKey}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar - hidden on mobile */}
        <div className="hidden md:block">
          <Sidebar
            connectedProviders={connectedProviders}
            selectedProvider={selectedProvider}
            activeAccountKey={activeAccountKey}
            onNavigate={handleNavigate}
          />
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-4xl mx-auto">
            <div className="page-header">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connections</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  All provider connections from server state
                </p>
              </div>
              <button
                onClick={() => fetchConnections(token)}
                disabled={loading}
                className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>

            {error && (
              <div
                data-testid="cf-connections-error"
                className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm"
              >
                {error}
              </div>
            )}

            {loading && connections.length === 0 ? (
              <div data-testid="cf-connections-loading" className="text-center py-12 text-gray-400">
                Loading connections…
              </div>
            ) : connections.length === 0 && !error ? (
              <div
                data-testid="cf-connections-empty"
                className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700"
              >
                <p className="text-gray-500 dark:text-gray-400 mb-3">No provider connections found</p>
                <a
                  href="/providers"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Add your first provider →
                </a>
              </div>
            ) : (
              <div
                data-testid="cf-connections-list"
                className="space-y-3"
              >
                {connections.map((conn) => (
                  <div
                    key={`${conn.provider}:${conn.accountKey}`}
                    data-testid={`cf-connection-item-${conn.accountKey}`}
                    className="responsive-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {conn.accountLabel || conn.accountName}
                        </span>
                        {conn.accountEmail && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {conn.accountEmail}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                          {conn.provider}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`self-start sm:self-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[conn.status] ?? STATUS_COLOR.disconnected}`}
                    >
                      {STATUS_LABEL[conn.status] ?? conn.status}
                    </span>
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
