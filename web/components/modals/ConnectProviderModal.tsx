'use client'

import { useState } from 'react'
import { getProvider } from '@/lib/providers'
import { tokenManager } from '@/lib/tokenManager'
import { useActionCenter } from '@/components/ActionCenterProvider'
import { useIntegration } from '@/context/IntegrationContext'
import { PROVIDERS, ProviderId } from '@/lib/providers/types'
import { authFetch } from '@/lib/apiClient'

function resolveAccountKey(providerId: ProviderId, providerToken: {
  accountKey?: string
  accountId?: string
  accountEmail?: string
  displayName?: string
}) {
  return (
    providerToken.accountKey ||
    providerToken.accountId ||
    providerToken.accountEmail ||
    providerToken.displayName ||
    `${providerId}-primary`
  )
}

export default function ConnectProviderModal() {
  const { modalState, closeModal } = useIntegration()
  const [connecting, setConnecting] = useState(false)
  const actions = useActionCenter()

  if (!modalState.isOpen || modalState.modalType !== 'connect') return null
  if (!modalState.providerId) return null

  // WebDAV and VPS have separate modals
  if (modalState.providerId === 'webdav' || modalState.providerId === 'vps') return null

  const provider = PROVIDERS.find(p => p.id === modalState.providerId)
  if (!provider) return null

  const handleConnect = async () => {
    setConnecting(true)
    let connectedAccountKey: string | null = null
    try {
      const providerId = modalState.providerId as ProviderId
      const providerInstance = getProvider(providerId)
      if (!providerInstance) throw new Error('Provider not available')
      const providerToken = await providerInstance.connect()
      connectedAccountKey = resolveAccountKey(providerId, providerToken)

      const response = await authFetch('/api/remotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerId,
          accountKey: connectedAccountKey,
          accessToken: providerToken.accessToken,
          refreshToken: providerToken.refreshToken,
          expiresAt: providerToken.expiresAt,
          accountId: providerToken.accountId,
          accountEmail: providerToken.accountEmail,
          displayName: providerToken.displayName,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save provider connection')
      }

      const remoteId =
        payload?.data?.remote?.id ||
        payload?.remote?.id ||
        undefined

      tokenManager.saveToken(providerId, {
        provider: providerId,
        accessToken: '',
        refreshToken: undefined,
        accountKey: connectedAccountKey,
        accountId: providerToken.accountId,
        accountEmail: providerToken.accountEmail,
        displayName: providerToken.displayName,
        expiresAt: null,
      } as any, remoteId)

      actions.notify({
        kind: 'success',
        title: 'Connected',
        message: `${provider?.name || providerId} connected successfully`,
      })
      closeModal()
      window.dispatchEvent(
        new CustomEvent('cacheflow:remote-connected', {
          detail: { providerId, remoteId, accountKey: connectedAccountKey },
        }),
      )
    } catch (err: any) {
      actions.notify({ kind: 'error', title: 'Connection Failed', message: err.message })
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,8,12,0.72)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)] p-6 shadow-[0_36px_90px_rgba(0,0,0,0.42)]">
        <div className="mb-6">
          <div className="cf-kicker mb-2">Providers</div>
          <h3 className="text-xl font-semibold text-[var(--cf-text-0)]">Connect {provider.name}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--cf-text-1)]">{provider.description}</p>
        </div>
        <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3">
          <div className="cf-kicker mb-1">Flow</div>
          <p className="text-sm text-[var(--cf-text-2)]">
            Authorize with the provider, then CacheFlow will persist the connection in your control plane.
          </p>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={closeModal}
            className="flex-1 rounded-xl border border-[var(--cf-border)] px-4 py-2.5 text-sm font-medium text-[var(--cf-text-1)] transition hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex-1 rounded-xl border border-[rgba(74,158,255,0.28)] bg-[rgba(74,158,255,0.14)] px-4 py-2.5 text-sm font-medium text-[var(--cf-blue)] transition hover:bg-[rgba(74,158,255,0.2)] disabled:opacity-50"
          >
            {connecting ? 'Connecting...' : 'Authorize'}
          </button>
        </div>
      </div>
    </div>
  )
}
