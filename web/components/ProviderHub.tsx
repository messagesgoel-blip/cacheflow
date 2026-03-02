'use client'

import { useState, useEffect } from 'react'
import { PROVIDERS, ProviderId, ConnectedProvider, ProviderQuota, formatBytes } from '@/lib/providers/types'
import { getProvider } from '@/lib/providers'
import { tokenManager } from '@/lib/tokenManager'
import { useActionCenter } from '@/components/ActionCenterProvider'
import { useIntegration } from '@/context/IntegrationContext'

export default function ProviderHub() {
  const [connectedProviders, setConnectedProviders] = useState<ConnectedProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [healthStates, setHealthStates] = useState<Record<string, { status: string, message?: string }>>({})
  const actions = useActionCenter()

  const limits = {
    perProvider: 3,
    total: 15,
  }

  // Load connected providers
  useEffect(() => {
    async function loadConnectedProviders() {
      try {
        const providerIds: ProviderId[] = ['google', 'onedrive', 'dropbox', 'box', 'pcloud', 'filen', 'yandex', 'webdav', 'vps']
        const connected: ConnectedProvider[] = []
        
        for (const pid of providerIds) {
          const tokens = tokenManager.getTokens(pid as ProviderId).filter(t => !t.disabled)
          tokens.forEach((token, idx) => {
            if (token && (token.accessToken || (token as any).remoteId)) {
              connected.push({
                providerId: pid as ProviderId,
                status: 'connected' as any,
                accountEmail: token.accountEmail || '',
                displayName: token.displayName || `${pid}-${idx+1}`,
                accountKey: token.accountKey,
                connectedAt: Date.now(),
                quota: undefined,
              })
            }
          })
        }
        setConnectedProviders(connected)
        
        // Fetch health lazily
        const mainToken = localStorage.getItem('cf_token')
        if (mainToken) {
          const newHealth: Record<string, any> = {}
          for (const cp of connected) {
            try {
              const tokens = JSON.parse(localStorage.getItem(`cacheflow_tokens_${cp.providerId}`) || '[]')
              const token = tokens.find((t: any) => t.accountKey === cp.accountKey)
              if (token?.remoteId) {
                const res = await fetch(`/api/remotes/${token.remoteId}/health`, {
                  headers: { Authorization: `Bearer ${mainToken}` }
                })
                const body = await res.json()
                if (body.ok) newHealth[`${cp.providerId}:${cp.accountKey}`] = body.data
              }
            } catch (e) {}
          }
          setHealthStates(newHealth)
        }
      } catch (e) {
        setConnectedProviders([])
      } finally {
        setLoading(false)
      }
    }
    loadConnectedProviders()
  }, [])

  const isConnected = (providerId: ProviderId) =>
    connectedProviders.some(cp => cp.providerId === providerId)

  const getConnectedProviderAccounts = (providerId: ProviderId) =>
    connectedProviders.filter(cp => cp.providerId === providerId)

  const totalUsed = connectedProviders.reduce((sum, cp) => sum + (cp.quota?.used ?? 0), 0)
  const totalTotal = connectedProviders.reduce((sum, cp) => sum + (cp.quota?.total ?? 0), 0)
  const totalFree = totalTotal - totalUsed

  return (
    <div className="p-6">
      <div className="mb-6 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-100">
        <p className="font-semibold text-blue-900 dark:text-blue-50">Connection limits</p>
        <p>You can connect up to {limits.perProvider} accounts per provider and up to {limits.total} cloud accounts total.</p>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Cloud Storage</h1>
        <p className="text-gray-600 dark:text-gray-400">Connect your cloud storage accounts to manage them in one place</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {PROVIDERS.map((provider) => {
            const connected = isConnected(provider.id)
            const accounts = getConnectedProviderAccounts(provider.id)

            return (
              <ProviderCard
                key={provider.id}
                provider={provider}
                connected={connected}
                accounts={accounts}
                healthStates={healthStates}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProviderCard({ provider, connected, accounts, healthStates }: any) {
  const { openConnectModal, openManageModal } = useIntegration()
  const actions = useActionCenter()

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'connected': return { label: 'Connected', color: 'bg-green-500', text: 'text-green-700 dark:text-green-400' }
      case 'degraded': return { label: 'Degraded', color: 'bg-yellow-500', text: 'text-yellow-700 dark:text-yellow-400' }
      case 'needs_reauth': return { label: 'Re-auth Required', color: 'bg-red-500', text: 'text-red-700 dark:text-red-400' }
      default: return { label: 'Unknown', color: 'bg-gray-300', text: 'text-gray-500' }
    }
  }

  return (
    <>
      <div className={`relative bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-2 transition-all duration-200 hover:shadow-md ${connected ? 'border-blue-100 dark:border-blue-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl" style={{ backgroundColor: provider.color + '20' }}>
            {getProviderIcon(provider.id)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{provider.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{provider.freeStorageGB > 0 ? `${provider.freeStorageGB} GB free` : 'Varies'}</p>
          </div>
        </div>

        {connected && (
          <div className="mb-4 space-y-3">
            {accounts.map((account: any) => {
              const health = healthStates[`${account.providerId}:${account.accountKey}`] || { status: 'unknown' }
              const display = getStatusDisplay(health.status)
              
              return (
                <div key={account.accountKey} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{account.displayName}</p>
                      <p className="text-[10px] text-gray-400 truncate">{account.accountEmail}</p>
                    </div>
                    <div 
                      data-testid={`cf-provider-health-chip-${account.accountKey}`}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 border border-current ${display.text} bg-current/5`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${display.color}`} />
                      {display.label}
                    </div>
                  </div>
                  {health.status === 'needs_reauth' && (
                    <button
                      data-testid={`cf-provider-reconnect-${account.accountKey}`}
                      onClick={() => openConnectModal(provider.id as ProviderId)}
                      className="w-full py-1.5 bg-red-600 text-white text-[10px] font-bold rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Reconnect Account
                    </button>
                  )}
                  {health.message && <p className="text-[10px] text-gray-500 italic">“{health.message}”</p>}
                </div>
              )
            })}
          </div>
        )}

        <button onClick={() => connected ? openManageModal(provider.id as ProviderId) : openConnectModal(provider.id as ProviderId)} className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors ${connected ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
          {connected ? 'Manage' : 'Connect'}
        </button>
      </div>
    </>
  )
}

function ConnectModal({ provider, connected, onClose }: any) {
  const [connecting, setConnecting] = useState(false)
  const actions = useActionCenter()

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const providerInstance = getProvider(provider.id)
      if (!providerInstance) throw new Error('Provider not available')
      const providerToken = await providerInstance.connect()
      tokenManager.saveToken(provider.id as ProviderId, {
        provider: provider.id as ProviderId,
        accessToken: providerToken.accessToken,
        accountEmail: providerToken.accountEmail,
        displayName: providerToken.displayName,
        accountId: providerToken.accountId,
      } as any)
      window.location.reload()
    } catch (err: any) {
      actions.notify({ kind: 'error', title: 'Connection Failed', message: err.message })
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
        <h3 className="text-lg font-semibold mb-2">Connect {provider.name}</h3>
        <p className="text-sm text-gray-500 mb-6">{provider.description}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 px-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          <button onClick={handleConnect} disabled={connecting} className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
            {connecting ? 'Connecting...' : 'Authorize'}
          </button>
        </div>
      </div>
    </div>
  )
}

function getProviderIcon(providerId: ProviderId): string {
  const icons: Record<ProviderId, string> = {
    google: '🗂️', onedrive: '☁️', dropbox: '📦', box: '📁', pcloud: '🧊', filen: '🔒', yandex: '📀', webdav: '🌐', vps: '🖥️', local: '💻',
  }
  return icons[providerId] || '📁'
}
