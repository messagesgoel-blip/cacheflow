'use client'

import { useState } from 'react'
import { useActionCenter } from '@/components/ActionCenterProvider'
import { useIntegration } from '@/context/IntegrationContext'

export default function VPSModal() {
  const { modalState, closeModal } = useIntegration()
  const [connecting, setConnecting] = useState(false)
  const [label, setLabel] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [pemFile, setPemFile] = useState<File | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const actions = useActionCenter()

  if (!modalState.isOpen || modalState.modalType !== 'connect' || modalState.providerId !== 'vps') return null

  const resetState = () => {
    setLabel('')
    setHost('')
    setPort('22')
    setUsername('')
    setPemFile(null)
    setInlineError(null)
    setConnecting(false)
  }

  const handleConnect = async () => {
    setInlineError(null)
    if (!label.trim() || !host.trim() || !username.trim()) {
      setInlineError('Label, host, and username are required.')
      return
    }
    if (!pemFile) {
      setInlineError('PEM key file is required.')
      return
    }

    const ext = pemFile.name.toLowerCase()
    if (!ext.endsWith('.pem') && !ext.endsWith('.key')) {
      setInlineError('PEM key must use .pem or .key extension.')
      return
    }

    setConnecting(true)
    try {
      const formData = new FormData()
      formData.append('label', label.trim())
      formData.append('host', host.trim())
      formData.append('port', String(Number.parseInt(port, 10) || 22))
      formData.append('username', username.trim())
      formData.append('pemFile', pemFile)

      const response = await fetch('/api/providers/vps', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setInlineError(result?.detail || result?.error || 'Connection test failed')
        return
      }

      actions.notify({
        kind: 'success',
        title: 'Connected',
        message: `${label.trim()} connected successfully`,
      })
      window.dispatchEvent(new CustomEvent('cacheflow:vps-connected', { detail: { id: result?.id } }))
      resetState()
      closeModal()
    } catch (err: any) {
      setInlineError(err?.message || 'Connection test failed')
    } finally {
      setConnecting(false)
    }
  }

  const handleClose = () => {
    resetState()
    closeModal()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full shadow-xl">
        <h3 className="text-lg font-semibold mb-2">Connect VPS / SFTP</h3>
        <p className="text-sm text-gray-500 mb-6">Connect your VPS using PEM key authentication.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="OCI Node 1"
              required
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Host <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="203.0.113.1"
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
          <div>
            <label className="block text-sm font-medium mb-1">
              PEM Key <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept=".pem,.key"
              onChange={(e) => setPemFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Your private key is encrypted before storage and never returned after saving.
            </p>
            {pemFile && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Selected: {pemFile.name}</p>
            )}
          </div>
        </div>

        {inlineError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {inlineError}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={handleClose} className="flex-1 py-2 px-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          <button onClick={handleConnect} disabled={connecting} className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
            {connecting ? 'Testing connection…' : 'Test & Connect'}
          </button>
        </div>
      </div>
    </div>
  )
}
