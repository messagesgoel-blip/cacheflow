'use client'

import { useState, useCallback } from 'react'
import { useActionCenter } from '@/components/ActionCenterProvider'
import { useIntegration } from '@/context/IntegrationContext'
import { authFetch } from '@/lib/apiClient'

export default function WebDAVModal() {
  const { modalState, closeModal } = useIntegration()
  const [connecting, setConnecting] = useState(false)
  const [serverUrl, setServerUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const actions = useActionCenter()

  if (!modalState.isOpen || modalState.modalType !== 'connect' || modalState.providerId !== 'webdav') return null

  const handleConnect = async () => {
    if (!serverUrl || !username || !password) {
      actions.notify({ kind: 'error', title: 'Missing Fields', message: 'Please fill in all required fields' })
      return
    }
    setConnecting(true)
    try {
      // POST to /api/connections (exact endpoint)
      const response = await authFetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'webdav',
          serverUrl,
          username,
          password,
          displayName: displayName || undefined,
        }),
      })

      const result = await response.json() as { success: boolean; connectionId?: string; error?: string }

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to connect')
      }

      actions.notify({ kind: 'success', title: 'Connected', message: 'WebDAV connection created successfully' })
      closeModal()

      // Clear sensitive data from state
      setPassword('')
      setServerUrl('')
      setUsername('')
      setDisplayName('')
    } catch (err: any) {
      actions.notify({ kind: 'error', title: 'Connection Failed', message: err.message || 'Failed to connect to WebDAV server' })
    } finally {
      setConnecting(false)
    }
  }

  const handleClose = useCallback(() => {
    setPassword('')
    setServerUrl('')
    setUsername('')
    setDisplayName('')
    closeModal()
  }, [closeModal])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
        <h3 className="text-lg font-semibold mb-2">Connect WebDAV</h3>
        <p className="text-sm text-gray-500 mb-6">Enter your WebDAV server credentials</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Server URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://dav.example.com/dav"
              required
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              required
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password"
              required
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Display Name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My WebDAV Server"
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={handleClose} className="flex-1 py-2 px-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          <button onClick={handleConnect} disabled={connecting} className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}
