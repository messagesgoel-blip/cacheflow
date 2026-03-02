'use client'

import { useState } from 'react'
import { getProvider } from '@/lib/providers'
import { tokenManager } from '@/lib/tokenManager'
import { useActionCenter } from '@/components/ActionCenterProvider'
import { useIntegration } from '@/context/IntegrationContext'

export default function VPSModal() {
  const { modalState, closeModal } = useIntegration()
  const [connecting, setConnecting] = useState(false)
  const [server, setServer] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const actions = useActionCenter()

  if (!modalState.isOpen || modalState.modalType !== 'connect' || modalState.providerId !== 'vps') return null

  const handleConnect = async () => {
    if (!server || !username || !password) {
      actions.notify({ kind: 'error', title: 'Missing Fields', message: 'Please fill in all required fields' })
      return
    }
    setConnecting(true)
    try {
      const providerInstance = getProvider('vps')
      if (!providerInstance) throw new Error('Provider not available')

      // VPS/SFTP specific connect
      const providerToken = await (providerInstance as any).connectWithCredentials({
        server,
        port: parseInt(port) || 22,
        username,
        password
      })

      tokenManager.saveToken('vps', {
        provider: 'vps',
        accessToken: providerToken.accessToken,
        accountEmail: `${username}@${server}`,
        displayName: server,
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
        <h3 className="text-lg font-semibold mb-2">Connect VPS / SFTP</h3>
        <p className="text-sm text-gray-500 mb-6">Enter your VPS/SFTP server credentials</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Server</label>
            <input
              type="text"
              value={server}
              onChange={(e) => setServer(e.target.value)}
              placeholder="your-server.com"
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
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password / Private Key</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="password or private key"
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={closeModal} className="flex-1 py-2 px-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          <button onClick={handleConnect} disabled={connecting} className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}
