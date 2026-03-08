'use client'

import { useState, useEffect, useMemo } from 'react'
import { ProviderId, PROVIDERS, ConnectedProvider } from '@/lib/providers/types'
import { tokenManager } from '@/lib/tokenManager'
import { useActionCenter } from '@/components/ActionCenterProvider'

interface RemoteUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function RemoteUploadModal({ isOpen, onClose }: RemoteUploadModalProps) {
  const [url, setUrl] = useState('')
  const [filename, setFilename] = useState('')
  const [targetProvider, setTargetProvider] = useState<ProviderId | ''>('')
  const [targetAccountKey, setTargetAccountKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const actions = useActionCenter()

  // Get connected providers (excluding local)
  const connectedProviders = useMemo<ConnectedProvider[]>(() => {
    const result: ConnectedProvider[] = []
    const providerIds: ProviderId[] = ['google', 'onedrive', 'dropbox', 'box', 'pcloud', 'filen', 'yandex', 'webdav', 'vps']

    for (const pid of providerIds) {
      const tokens = tokenManager.getTokens(pid).filter(t => !t.disabled)
      tokens.forEach(t => {
        if (t) {
          result.push({
            providerId: pid,
            status: 'connected',
            accountEmail: t.accountEmail || '',
            displayName: t.displayName || `${pid} account`,
            accountKey: t.accountKey || t.accountEmail || '',
            connectedAt: Date.now(),
          })
        }
      })
    }

    return result
  }, [isOpen])

  // Get unique providers for dropdown
  const uniqueProviders = useMemo(() => {
    const seen = new Set<string>()
    return connectedProviders.filter(cp => {
      if (seen.has(cp.providerId)) return false
      seen.add(cp.providerId)
      return true
    })
  }, [connectedProviders])

  // Auto-select first provider when modal opens
  useEffect(() => {
    if (isOpen && uniqueProviders.length > 0 && !targetProvider) {
      setTargetProvider(uniqueProviders[0].providerId)
      const firstProviderAccounts = connectedProviders.filter(
        cp => cp.providerId === uniqueProviders[0].providerId
      )
      if (firstProviderAccounts.length > 0 && firstProviderAccounts[0].accountKey) {
        setTargetAccountKey(firstProviderAccounts[0].accountKey)
      }
    }
  }, [isOpen, uniqueProviders, connectedProviders, targetProvider])

  // Get accounts for selected provider
  const providerAccounts = useMemo(() => {
    if (!targetProvider) return []
    return connectedProviders.filter(cp => cp.providerId === targetProvider)
  }, [targetProvider, connectedProviders])

  // Reset form when closed
  useEffect(() => {
    if (!isOpen) {
      setUrl('')
      setFilename('')
      setTargetProvider('')
      setTargetAccountKey('')
      setError(null)
      setLoading(false)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, loading, onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Validate URL
  const isValidUrl = (urlString: string): boolean => {
    try {
      const urlObj = new URL(urlString)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  // Extract filename from URL
  const extractFilename = (urlString: string): string => {
    try {
      const urlObj = new URL(urlString)
      const pathname = urlObj.pathname
      const parts = pathname.split('/')
      const lastPart = parts[parts.length - 1]
      // Return decoded filename if it looks like a file
      if (lastPart && lastPart.includes('.')) {
        return decodeURIComponent(lastPart)
      }
      // Check for query params that might contain filename
      const contentDisposition = urlObj.searchParams.get('filename')
      if (contentDisposition) {
        return decodeURIComponent(contentDisposition)
      }
      return ''
    } catch {
      return ''
    }
  }

  // Handle URL change - auto-fill filename
  const handleUrlChange = (value: string) => {
    setUrl(value)
    setError(null)

    // Auto-fill filename if empty
    if (!filename && value) {
      const extracted = extractFilename(value)
      if (extracted) {
        setFilename(extracted)
      }
    }
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    if (!isValidUrl(url)) {
      setError('Please enter a valid HTTP or HTTPS URL')
      return
    }

    if (!targetProvider) {
      setError('Please select a target provider')
      return
    }

    if (!targetAccountKey) {
      setError('Please select an account')
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem('cf_token')
      if (!token) {
        throw new Error('Not authenticated')
      }

      const requestBody = {
        url: url.trim(),
        provider: targetProvider,
        filename: filename.trim() || undefined,
        metadata: {
          accountKey: targetAccountKey,
          // If we have a special rclone name, we'd pass it here. 
          // For now our backend assumes providerId matches rclone remote names or maps them.
          remoteName: targetProvider === 'google' ? 'gdrive' : targetProvider,
        },
      }

      const response = await fetch('/api/remote-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Upload failed')
      }

      // Show success notification
      actions.notify({
        kind: 'success',
        title: 'Remote Upload Started',
        message: filename || extractFilename(url) || 'File is being downloaded',
      })

      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to start remote upload')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !loading && onClose()}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <span className="text-xl">🔗</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Remote Upload
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Download a file from a URL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* URL Input */}
          <div>
            <label htmlFor="remote-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Source URL <span className="text-red-500">*</span>
            </label>
            <input
              id="remote-url"
              type="text"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://example.com/file.pdf"
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Enter the direct download URL (HTTP or HTTPS)
            </p>
          </div>

          {/* Filename Input (Optional) */}
          <div>
            <label htmlFor="filename" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filename <span className="text-gray-400">(optional)</span>
            </label>
            <input
              id="filename"
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder={extractFilename(url) || 'Auto-detected from URL'}
              disabled={loading}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Override the filename that will be saved
            </p>
          </div>

          {/* Target Provider */}
          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Upload to <span className="text-red-500">*</span>
            </label>
            <select
              id="provider"
              value={targetProvider}
              onChange={(e) => {
                setTargetProvider(e.target.value as ProviderId)
                setTargetAccountKey('')
              }}
              disabled={loading || uniqueProviders.length === 0}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">
                {uniqueProviders.length === 0 ? 'No providers connected' : 'Select a provider'}
              </option>
              {uniqueProviders.map((provider) => (
                <option key={provider.providerId} value={provider.providerId}>
                  {PROVIDERS.find(p => p.id === provider.providerId)?.icon}{' '}
                  {PROVIDERS.find(p => p.id === provider.providerId)?.name || provider.providerId}
                </option>
              ))}
            </select>
          </div>

          {/* Target Account */}
          {targetProvider && providerAccounts.length > 1 && (
            <div>
              <label htmlFor="account" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Account <span className="text-red-500">*</span>
              </label>
              <select
                id="account"
                value={targetAccountKey}
                onChange={(e) => setTargetAccountKey(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">Select an account</option>
                {providerAccounts.map((account) => (
                  <option key={account.accountKey} value={account.accountKey}>
                    {account.displayName || account.accountEmail}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uniqueProviders.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {loading ? 'Starting Upload...' : 'Start Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
