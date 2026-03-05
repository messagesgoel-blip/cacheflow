'use client'

import { useState, useEffect } from 'react'
import UnifiedFileBrowser from '@/components/UnifiedFileBrowser'
import Navbar from '@/components/Navbar'
import SidebarNav from '@/components/Sidebar/SidebarNav'
import VaultFolderRow from '@/components/Sidebar/VaultFolderRow'
import UnlockVaultModal from '@/components/vault/UnlockVaultModal'
import '@/styles/layout.css'

// Disclaimer text for vault
const VAULT_DISCLAIMER = 'Private Folder hides files from All Files and search, but does not provide encryption. Your files remain accessible to anyone with provider access.'

export default function FilesPage() {
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [connectedProviders, setConnectedProviders] = useState<any[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [activeAccountKey, setActiveAccountKey] = useState('')

  // Vault state
  const [vaultEnabled, setVaultEnabled] = useState(false)
  const [vaultLocked, setVaultLocked] = useState(true)
  const [vaultId, setVaultId] = useState<string | null>(null)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [vaultSessionToken, setVaultSessionToken] = useState<string | null>(null)

  useEffect(() => {
    const t = localStorage.getItem('cf_token')
    const e = localStorage.getItem('cf_email')
    if (t && e) {
      setToken(t)
      setEmail(e)
    }
  }, [])

  // Fetch connected providers for sidebar
  useEffect(() => {
    if (!token) return

    const fetchProviders = async () => {
      try {
        const res = await fetch('/api/connections', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const body = await res.json()
        if (body.success && body.data) {
          const connected = body.data
            .filter((c: any) => c.status === 'connected')
            .map((c: any) => ({
              providerId: c.provider,
              status: c.status,
              accountEmail: c.accountEmail,
              displayName: c.accountLabel || c.accountName,
              accountKey: c.accountKey,
              connectedAt: c.lastSyncAt ? new Date(c.lastSyncAt).getTime() : Date.now(),
              lastSyncedAt: c.lastSyncAt ? new Date(c.lastSyncAt).getTime() : undefined,
            }))
          setConnectedProviders(connected)
        }
      } catch (err) {
        console.error('Failed to fetch providers:', err)
      }
    }

    fetchProviders()
  }, [token])

  // Fetch vault status on mount
  useEffect(() => {
    if (!token) return

    const fetchVaultStatus = async () => {
      try {
        const res = await fetch('/api/vault', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const body = await res.json()
        if (body.isEnabled) {
          setVaultEnabled(true)
          // Generate a vault ID for this user (in real implementation, this would come from the API)
          setVaultId(`vault_${token.substring(0, 8)}`)
          // Check if there's an existing session in localStorage
          const storedSession = localStorage.getItem('vault_session')
          if (storedSession) {
            const session = JSON.parse(storedSession)
            if (new Date(session.expiresAt) > new Date()) {
              setVaultSessionToken(session.token)
              setVaultLocked(false)
            } else {
              localStorage.removeItem('vault_session')
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch vault status:', err)
      }
    }

    fetchVaultStatus()
  }, [token])

  // Handle vault unlock
  const handleVaultUnlock = async (pin: string): Promise<boolean> => {
    if (!vaultId) return false

    try {
      const res = await fetch(`/api/vault/${vaultId}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin }),
      })

      const body = await res.json()

      if (body.success) {
        // Store session token
        setVaultSessionToken(body.session_token)
        setVaultLocked(false)
        localStorage.setItem('vault_session', JSON.stringify({
          token: body.session_token,
          expiresAt: body.expires_at,
        }))
        return true
      }

      return false
    } catch (err) {
      console.error('Failed to unlock vault:', err)
      return false
    }
  }

  // Handle vault navigation
  const handleVaultNavigate = () => {
    if (vaultEnabled) {
      if (vaultLocked) {
        setShowUnlockModal(true)
      } else {
        setSelectedProvider('vault')
      }
    }
  }

  // Filter vault files from All Files view
  // Note: This is a placeholder - actual filtering requires UnifiedFileBrowser modification
  const handleNavigate = (providerId: any, accountKey?: string) => {
    // When navigating to 'all', vault files should be filtered out
    // This would be implemented in UnifiedFileBrowser
    setSelectedProvider(providerId)
    if (accountKey) setActiveAccountKey(accountKey)
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Please log in to browse your files</p>
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
        selectedProvider={selectedProvider as any}
        activeAccountKey={activeAccountKey}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        vaultEnabled={vaultEnabled}
        vaultLocked={vaultLocked}
        onVaultNavigate={handleVaultNavigate}
      />

      <div className="layout-with-sidebar">
        {/* Desktop sidebar - hidden on mobile */}
        <aside className="hidden md:flex flex-col h-[calc(100vh-64px)] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 w-64 flex-shrink-0">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              CacheFlow
            </span>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
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

            {/* Vault / Private Folder */}
            {vaultEnabled && (
              <VaultFolderRow
                isSelected={selectedProvider === 'vault'}
                isLocked={vaultLocked}
                onClick={handleVaultNavigate}
              />
            )}

            {/* Setup Vault CTA when not enabled */}
            {!vaultEnabled && (
              <button
                onClick={() => {
                  // TODO: Open vault setup modal with disclaimer
                  alert(VAULT_DISCLAIMER)
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="text-xl">🔒</span>
                <span>Enable Private Folder</span>
              </button>
            )}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* Vault header with disclaimer when viewing vault */}
          {selectedProvider === 'vault' && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400">🔒</span>
                <div>
                  <h2 className="font-medium text-amber-900 dark:text-amber-100">Private Folder</h2>
                  <p className="text-sm text-amber-700 dark:text-amber-300">{VAULT_DISCLAIMER}</p>
                </div>
              </div>
            </div>
          )}
          <div className="max-w-7xl mx-auto">
            <UnifiedFileBrowser token={token} />
          </div>
        </main>
      </div>

      {/* Unlock Vault Modal */}
      <UnlockVaultModal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        onUnlock={handleVaultUnlock}
      />
    </div>
  )
}
