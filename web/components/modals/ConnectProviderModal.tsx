'use client'

import { useState } from 'react'
import { getProvider } from '@/lib/providers'
import { tokenManager } from '@/lib/tokenManager'
import { useActionCenter } from '@/components/ActionCenterProvider'
import { useIntegration } from '@/context/IntegrationContext'
import { PROVIDERS, ProviderId } from '@/lib/providers/types'

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
    try {
      const providerInstance = getProvider(modalState.providerId as ProviderId)
      if (!providerInstance) throw new Error('Provider not available')
      const providerToken = await providerInstance.connect()
      tokenManager.saveToken(modalState.providerId as ProviderId, {
        provider: modalState.providerId as ProviderId,
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
          <button onClick={closeModal} className="flex-1 py-2 px-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          <button onClick={handleConnect} disabled={connecting} className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
            {connecting ? 'Connecting...' : 'Authorize'}
          </button>
        </div>
      </div>
    </div>
  )
}

