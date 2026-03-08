'use client'

import { useState, useEffect } from 'react'
import { ProviderId, ConnectedProvider } from '@/lib/providers/types'
import VaultFolderRow from './VaultFolderRow'

interface SidebarNavProps {
  connectedProviders: ConnectedProvider[]
  selectedProvider: ProviderId | 'all' | 'recent' | 'starred' | 'activity' | 'vault'
  activeAccountKey: string
  onNavigate: (providerId: ProviderId | 'all' | 'recent' | 'starred' | 'activity' | 'vault', accountKey?: string) => void
  isOpen: boolean
  onClose: () => void
  // Vault props
  vaultEnabled?: boolean
  vaultLocked?: boolean
  onVaultNavigate?: () => void
}

export default function SidebarNav({
  connectedProviders,
  selectedProvider,
  activeAccountKey,
  onNavigate,
  isOpen,
  onClose,
  vaultEnabled = false,
  vaultLocked = true,
  onVaultNavigate,
}: SidebarNavProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  // Close sidebar on navigation (mobile)
  const handleNavigate = (providerId: ProviderId | 'all' | 'recent' | 'starred' | 'activity', accountKey?: string) => {
    onNavigate(providerId, accountKey)
    onClose()
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile sidebar */}
      <aside
        className={`sidebar-mobile ${isOpen ? 'open' : ''}`}
        aria-label="Navigation sidebar"
      >
        <div className="h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
          {/* Mobile header */}
          <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
            <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              CacheFlow
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation items */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => handleNavigate('all')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                selectedProvider === 'all'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span className="text-xl">📁</span>
              <span>All Files</span>
            </button>

            <button
              onClick={() => handleNavigate('recent')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                selectedProvider === 'recent'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span className="text-xl">🕒</span>
              <span>Recent</span>
            </button>

            <button
              onClick={() => handleNavigate('starred')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                selectedProvider === 'starred'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span className="text-xl">⭐</span>
              <span>Starred</span>
            </button>

            <button
              onClick={() => handleNavigate('activity')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                selectedProvider === 'activity'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <span className="text-xl">⚡</span>
              <span>Activity Feed</span>
            </button>

            {/* Vault / Private Folder */}
            {vaultEnabled && onVaultNavigate && (
              <VaultFolderRow
                isSelected={selectedProvider === 'vault'}
                isLocked={vaultLocked}
                onClick={onVaultNavigate}
              />
            )}

            <div className="my-4 border-t border-gray-100 dark:border-gray-800" />

            {/* Provider list */}
            {connectedProviders.map((account) => (
              <button
                key={account.accountKey}
                data-testid={`cf-sidebar-account-${account.accountKey}`}
                onClick={() => handleNavigate(account.providerId, account.accountKey)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  selectedProvider === account.providerId && activeAccountKey === account.accountKey
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span className="text-xl">
                  {account.providerId === 'google' ? '📧' :
                   account.providerId === 'dropbox' ? '📦' :
                   account.providerId === 'onedrive' ? '☁️' : '📁'}
                </span>
                <div className="flex flex-col items-start overflow-hidden">
                  <span className="truncate text-sm">{account.displayName}</span>
                  <span className="truncate text-xs text-gray-400">{account.accountEmail}</span>
                </div>
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <a
              href="/providers"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-xl">➕</span>
              <span className="text-sm font-medium">Add Provider</span>
            </a>
          </div>
        </div>
      </aside>
    </>
  )
}

