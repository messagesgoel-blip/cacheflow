'use client'

import { useState, useEffect } from 'react'

interface TwoFASettings {
  enabled: boolean
  lastUsed?: string
  backupCodesRemaining?: number
}

interface TwoFAPanelProps {
  onSetup?: () => void
  onDisable?: () => void
}

export default function TwoFAPanel({ onSetup, onDisable }: TwoFAPanelProps) {
  const [settings, setSettings] = useState<TwoFASettings>({ enabled: false })
  const [loading, setLoading] = useState(true)
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTwoFASettings()
  }, [])

  const fetchTwoFASettings = async () => {
    try {
      const response = await fetch('/api/auth/2fa/status', { credentials: 'include' })
      const data = await response.json()
      if (data.enabled !== undefined) {
        setSettings(data)
      }
    } catch (err) {
      console.error('Failed to fetch 2FA settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateBackupCodes = async () => {
    setError('')
    try {
      const response = await fetch('/api/auth/2fa/backup-codes', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to generate backup codes')
        return
      }
      setBackupCodes(data.backupCodes)
      setShowBackupCodes(true)
    } catch (err) {
      setError('Failed to generate backup codes')
    }
  }

  const handleDisable = async () => {
    if (!confirm('Are you sure you want to disable two-factor authentication? This will make your account less secure.')) {
      return
    }

    setError('')
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to disable 2FA')
        return
      }
      setSettings({ enabled: false })
      onDisable?.()
    } catch (err) {
      setError('Failed to disable 2FA')
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${settings.enabled ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-700'}`}>
            <svg className={`w-6 h-6 ${settings.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-500">
              {settings.enabled ? 'Enabled' : 'Not enabled'}
            </p>
          </div>
        </div>
        {settings.enabled && (
          <button
            onClick={handleDisable}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Disable
          </button>
        )}
      </div>

      {settings.enabled && (
        <div className="space-y-4">
          {settings.lastUsed && (
            <div className="text-sm text-gray-500">
              Last used: {new Date(settings.lastUsed).toLocaleString()}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleGenerateBackupCodes}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
            >
              Generate Backup Codes
            </button>
            {settings.backupCodesRemaining !== undefined && (
              <span className="text-sm text-gray-500 self-center">
                {settings.backupCodesRemaining} codes remaining
              </span>
            )}
          </div>

          {showBackupCodes && backupCodes.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Backup Codes</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(backupCodes.join('\n'))
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Copy all
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, i) => (
                  <code key={i} className="text-gray-600 dark:text-gray-400">{code}</code>
                ))}
              </div>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                Store these codes in a safe place. Each code can only be used once.
              </p>
            </div>
          )}
        </div>
      )}

      {!settings.enabled && (
        <button
          onClick={onSetup}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
        >
          Enable Two-Factor Authentication
        </button>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
