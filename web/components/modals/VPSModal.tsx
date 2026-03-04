'use client'

import { useState, useCallback } from 'react'
import { useActionCenter } from '@/components/ActionCenterProvider'
import { useIntegration } from '@/context/IntegrationContext'
import { authFetch } from '@/lib/apiClient'

type AuthMethod = 'password' | 'sshKey'

export default function VPSModal() {
  const { modalState, closeModal } = useIntegration()
  const [connecting, setConnecting] = useState(false)
  const [server, setServer] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password')
  const [password, setPassword] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const actions = useActionCenter()

  if (!modalState.isOpen || modalState.modalType !== 'connect' || modalState.providerId !== 'vps') return null

  const handleConnect = async () => {
    if (!server || !username) {
      actions.notify({ kind: 'error', title: 'Missing Fields', message: 'Please fill in all required fields' })
      return
    }
    if (authMethod === 'password' && !password) {
      actions.notify({ kind: 'error', title: 'Missing Password', message: 'Please enter your password' })
      return
    }
    if (authMethod === 'sshKey' && !privateKey) {
      actions.notify({ kind: 'error', title: 'Missing SSH Key', message: 'Please enter your private key' })
      return
    }

    setConnecting(true)
    try {
      // POST to /api/connections (exact endpoint) with type="sftp"
      const payload: Record<string, unknown> = {
        type: 'sftp',
        server,
        port: parseInt(port) || 22,
        username,
        authMethod,
      }

      if (authMethod === 'password') {
        payload.password = password
      } else {
        payload.privateKey = privateKey
        if (passphrase) {
          payload.passphrase = passphrase
        }
      }

      const response = await authFetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json() as { success: boolean; connectionId?: string; error?: string }

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to connect')
      }

      actions.notify({ kind: 'success', title: 'Connected', message: 'SFTP connection created successfully' })
      closeModal()

      // Clear sensitive data from state
      setPassword('')
      setPrivateKey('')
      setPassphrase('')
      setServer('')
      setUsername('')
      setPort('22')
    } catch (err: any) {
      actions.notify({ kind: 'error', title: 'Connection Failed', message: err.message || 'Failed to connect to SFTP server' })
    } finally {
      setConnecting(false)
    }
  }

  const handleClose = useCallback(() => {
    setPassword('')
    setPrivateKey('')
    setPassphrase('')
    setServer('')
    setUsername('')
    setPort('22')
    closeModal()
  }, [closeModal])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
        <h3 className="text-lg font-semibold mb-2">Connect VPS / SFTP</h3>
        <p className="text-sm text-gray-500 mb-6">Enter your VPS/SFTP server credentials</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Host <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="your-server.com"
              required
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Port</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="22"
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

          {/* Auth Method Toggle */}
          <div>
            <label className="block text-sm font-medium mb-2">Authentication Method</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="authMethod"
                  value="password"
                  checked={authMethod === 'password'}
                  onChange={() => setAuthMethod('password')}
                  className="w-4 h-4 text-blue-500"
                />
                <span className="text-sm">Password</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="authMethod"
                  value="sshKey"
                  checked={authMethod === 'sshKey'}
                  onChange={() => setAuthMethod('sshKey')}
                  className="w-4 h-4 text-blue-500"
                />
                <span className="text-sm">SSH Key</span>
              </label>
            </div>
          </div>

          {/* Password Field */}
          {authMethod === 'password' && (
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
          )}

          {/* SSH Key Fields */}
          {authMethod === 'sshKey' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Private Key <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                  required
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Passphrase <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="key passphrase"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </>
          )}
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
