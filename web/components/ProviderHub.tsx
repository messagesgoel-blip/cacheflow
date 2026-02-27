'use client'

import { useState, useEffect } from 'react'
import { PROVIDERS, ProviderId, ConnectedProvider, ProviderQuota, formatBytes } from '@/lib/providers/types'
import { tokenManager } from '@/lib/tokenManager'

interface ProviderHubProps {
}

export default function ProviderHub({}: ProviderHubProps) {
  const [connectedProviders, setConnectedProviders] = useState<ConnectedProvider[]>([])
  const [loading, setLoading] = useState(true)

  // Load connected providers from localStorage
  useEffect(() => {
    async function loadConnectedProviders() {
      try {
        const providerIds: ProviderId[] = ['google', 'onedrive', 'dropbox', 'box', 'pcloud', 'filen', 'yandex', 'webdav', 'vps']
        const connected: ConnectedProvider[] = []
        
        for (const pid of providerIds) {
          const token = tokenManager.getToken(pid as ProviderId)
          if (token && token.accessToken) {
            connected.push({
              providerId: pid as ProviderId,
              status: 'connected' as const,
              accountEmail: token.accountEmail || pid + '@connected.com',
              displayName: token.displayName || token.accountEmail?.split('@')[0] || pid,
              connectedAt: Date.now(),
              quota: undefined,
            })
          }
        }
        
        setConnectedProviders(connected.length > 0 ? connected : [])
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

  const getConnectedProvider = (providerId: ProviderId) =>
    connectedProviders.find(cp => cp.providerId === providerId)

  // Calculate total storage
  const totalUsed = connectedProviders.reduce((sum, cp) => sum + (cp.quota?.used ?? 0), 0)
  const totalTotal = connectedProviders.reduce((sum, cp) => sum + (cp.quota?.total ?? 0), 0)
  const totalFree = totalTotal - totalUsed

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Cloud Storage
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Connect your cloud storage accounts to manage them in one place
        </p>
      </div>

      {/* Combined Storage Summary */}
      {connectedProviders.length > 0 && (
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Total Storage
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {connectedProviders.length} provider{connectedProviders.length !== 1 ? 's' : ''} connected
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatBytes(totalUsed)} <span className="text-gray-400 font-normal">/ {formatBytes(totalTotal)}</span>
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                {formatBytes(totalFree)} free
              </p>
            </div>
          </div>

          {/* Combined Progress Bar */}
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${(totalUsed / totalTotal) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Provider Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {PROVIDERS.map((provider) => {
            const connected = isConnected(provider.id)
            const connectedProvider = getConnectedProvider(provider.id)

            return (
              <ProviderCard
                key={provider.id}
                provider={provider}
                connected={connected}
                quota={connectedProvider?.quota}
                accountEmail={connectedProvider?.accountEmail}
              />
            )
          })}
        </div>
      )}

      {/* Get More Storage Section */}
      {connectedProviders.length < PROVIDERS.length && (
        <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Unlock More Free Storage
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Connect more providers to combine their free tiers. You could have up to{' '}
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {formatBytes(PROVIDERS.filter(p => !isConnected(p.id)).reduce((sum, p) => sum + p.freeStorageGB * 1e9, 0))}
            </span>{' '}
            in additional free storage!
          </p>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.filter(p => !isConnected(p.id)).map((provider) => (
              <button
                key={provider.id}
                className="px-3 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-gray-700 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
              >
                + {provider.name} ({provider.freeStorageGB} GB)
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Provider Card Component
interface ProviderCardProps {
  provider: typeof PROVIDERS[0]
  connected: boolean
  quota?: ProviderQuota
  accountEmail?: string
}

function ProviderCard({ provider, connected, quota, accountEmail }: ProviderCardProps) {
  const [showConnectModal, setShowConnectModal] = useState(false)

  return (
    <>
      <div
        className={`relative bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border-2 transition-all duration-200 hover:shadow-md ${
          connected
            ? 'border-green-500 dark:border-green-500'
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
      >
        {/* Connected Badge */}
        {connected && (
          <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
            Connected
          </div>
        )}

        {/* Provider Icon & Name */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
            style={{ backgroundColor: provider.color + '20' }}
          >
            {getProviderIcon(provider.id)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {provider.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {provider.freeStorageGB > 0 ? `${provider.freeStorageGB} GB free` : 'Varies'}
            </p>
          </div>
        </div>

        {/* Connected Account Info */}
        {connected && quota && (
          <div className="mb-4">
            {accountEmail && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">
                {accountEmail}
              </p>
            )}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Used</span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {quota.usedDisplay}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    quota.percentUsed >= 90
                      ? 'bg-red-500'
                      : quota.percentUsed >= 80
                      ? 'bg-yellow-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(quota.percentUsed, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400 dark:text-gray-500">{quota.freeDisplay} free</span>
                <span className="text-gray-500 dark:text-gray-400">{quota.percentUsed.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={() => setShowConnectModal(true)}
          className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
            connected
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {/* Connect Modal (Placeholder) */}
      {showConnectModal && (
        <ConnectModal
          provider={provider}
          connected={connected}
          onClose={() => setShowConnectModal(false)}
        />
      )}
    </>
  )
}

// Connect/Disconnect Modal
interface ConnectModalProps {
  provider: typeof PROVIDERS[0]
  connected: boolean
  onClose: () => void
}

function ConnectModal({ provider, connected, onClose }: ConnectModalProps) {
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    setConnecting(true)
    // TODO: Implement OAuth flow
    // For Google: Open OAuth popup
    // For WebDAV: Show credentials form
    alert(`Connect ${provider.name}: OAuth flow not yet implemented`)
    setConnecting(false)
    onClose()
  }

  const handleDisconnect = async () => {
    if (confirm(`Are you sure you want to disconnect ${provider.name}?`)) {
      // TODO: Implement disconnect
      alert(`Disconnect ${provider.name}: Not yet implemented`)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: provider.color + '20' }}
          >
            {getProviderIcon(provider.id)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {connected ? 'Disconnect' : 'Connect'} {provider.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {provider.description}
            </p>
          </div>
        </div>

        {connected ? (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Are you sure you want to disconnect? You will need to reconnect to access these files again.
            </p>
          </div>
        ) : (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              You will be redirected to {provider.name} to authorize access. Your credentials are never sent to our servers.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={connected ? handleDisconnect : handleConnect}
            disabled={connecting}
            className={`flex-1 py-2 px-4 rounded-lg font-medium text-white transition-colors ${
              connected
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-blue-500 hover:bg-blue-600'
            } disabled:opacity-50`}
          >
            {connecting ? 'Connecting...' : connected ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Provider Icon Helper
function getProviderIcon(providerId: ProviderId): string {
  const icons: Record<ProviderId, string> = {
    google: '🗂️',
    onedrive: '☁️',
    dropbox: '📦',
    box: '📁',
    pcloud: '☁️',
    filen: '🔒',
    yandex: '📀',
    webdav: '🌐',
    vps: '🖥️',
  }
  return icons[providerId] || '📁'
}
