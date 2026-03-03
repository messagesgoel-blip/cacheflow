'use client'

import { useEffect, useState } from 'react'

interface TwoFASettings {
  enabled: boolean
  lastUsed?: string
  backupCodesRemaining?: number
}

interface TwoFASetupState {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
}

interface TwoFAPanelProps {
  onSetup?: () => void
  onDisable?: () => void
}

interface BasicApiResponse {
  success?: boolean
  error?: string
}

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') {
    return {}
  }

  const token = localStorage.getItem('cf_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function TwoFAPanel({ onSetup, onDisable }: TwoFAPanelProps) {
  const [settings, setSettings] = useState<TwoFASettings>({ enabled: false })
  const [loading, setLoading] = useState(true)
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [setupState, setSetupState] = useState<TwoFASetupState | null>(null)
  const [verificationCode, setVerificationCode] = useState('')
  const [isStartingSetup, setIsStartingSetup] = useState(false)
  const [isVerifyingSetup, setIsVerifyingSetup] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchTwoFASettings()
  }, [])

  const fetchTwoFASettings = async () => {
    try {
      const response = await fetch('/api/auth/2fa/status', {
        headers: getAuthHeaders(),
        credentials: 'include',
      })

      if (!response.ok) {
        setSettings({ enabled: false })
        return
      }

      const data = (await response.json()) as TwoFASettings
      if (data.enabled !== undefined) {
        setSettings(data)
      }
    } catch (err) {
      console.error('Failed to fetch 2FA settings:', err)
      setSettings({ enabled: false })
    } finally {
      setLoading(false)
    }
  }

  const handleStartSetup = async () => {
    setError('')
    setIsStartingSetup(true)

    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
      })
      const data = (await response.json()) as BasicApiResponse & Partial<TwoFASetupState>

      if (!response.ok || !data.success || !data.qrCodeUrl) {
        setError(data.error || 'Failed to initialize 2FA setup')
        return
      }

      setSetupState({
        secret: data.secret || '',
        qrCodeUrl: data.qrCodeUrl,
        backupCodes: data.backupCodes || [],
      })
      setBackupCodes(data.backupCodes || [])
      setShowBackupCodes(false)
      onSetup?.()
    } catch (err) {
      setError('Failed to initialize 2FA setup')
    } finally {
      setIsStartingSetup(false)
    }
  }

  const handleVerifySetup = async () => {
    if (!setupState) {
      return
    }

    if (!/^\d{6}$/.test(verificationCode)) {
      setError('Please enter a valid 6-digit code')
      return
    }

    setError('')
    setIsVerifyingSetup(true)

    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({
          code: verificationCode,
          ...(setupState.secret ? { secret: setupState.secret } : {}),
        }),
      })
      const data = (await response.json()) as BasicApiResponse

      if (!response.ok || !data.success) {
        setError(data.error || 'Verification failed')
        return
      }

      setSettings(prev => ({
        ...prev,
        enabled: true,
        lastUsed: new Date().toISOString(),
        backupCodesRemaining: backupCodes.length,
      }))
      setSetupState(null)
      setVerificationCode('')
      setShowBackupCodes(true)
    } catch (err) {
      setError('Verification failed')
    } finally {
      setIsVerifyingSetup(false)
    }
  }

  const handleGenerateBackupCodes = () => {
    setError('')
    if (backupCodes.length === 0) {
      setError('Backup codes are only shown during setup. Disable and re-enable 2FA to regenerate a new set.')
      return
    }
    setShowBackupCodes(true)
  }

  const handleDisable = async () => {
    const password = window.prompt('Enter your password to disable two-factor authentication')
    if (password === null) {
      return
    }

    setError('')
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
        body: JSON.stringify({ password }),
      })
      const data = (await response.json()) as BasicApiResponse

      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to disable 2FA')
        return
      }

      setSettings({ enabled: false, backupCodesRemaining: 0, lastUsed: undefined })
      setSetupState(null)
      setVerificationCode('')
      setShowBackupCodes(false)
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
    <div
      data-testid="cf-2fa-panel"
      className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ${
              settings.enabled ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            <svg
              className={`w-6 h-6 ${settings.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-500">{settings.enabled ? 'Enabled' : 'Not enabled'}</p>
          </div>
        </div>
        {settings.enabled && (
          <button onClick={handleDisable} className="text-sm text-red-600 hover:text-red-700">
            Disable
          </button>
        )}
      </div>

      {!settings.enabled && !setupState && (
        <button
          onClick={handleStartSetup}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          disabled={isStartingSetup}
        >
          {isStartingSetup ? 'Preparing setup...' : 'Enable Two-Factor Authentication'}
        </button>
      )}

      {!settings.enabled && setupState && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Scan this QR code in your authenticator app, then enter the 6-digit code.
          </p>
          <div className="bg-white p-3 rounded-lg border border-gray-200 inline-block">
            <img src={setupState.qrCodeUrl} alt="QR Code" className="w-48 h-48" />
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={verificationCode}
            onChange={event => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter 6-digit code"
            className="w-full max-w-xs px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
          <button
            onClick={handleVerifySetup}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
            disabled={isVerifyingSetup}
          >
            {isVerifyingSetup ? 'Verifying...' : 'Verify & Activate'}
          </button>
          {backupCodes.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Backup Codes</span>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm mt-2">
                {backupCodes.map((code, i) => (
                  <code key={i} className="text-gray-600 dark:text-gray-400">
                    {code}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {settings.enabled && (
        <div className="space-y-4">
          {settings.lastUsed && (
            <div className="text-sm text-gray-500">Last used: {new Date(settings.lastUsed).toLocaleString()}</div>
          )}
          <div className="flex gap-3">
            <button
              onClick={handleGenerateBackupCodes}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
            >
              View Backup Codes
            </button>
            {settings.backupCodesRemaining !== undefined && (
              <span className="text-sm text-gray-500 self-center">{settings.backupCodesRemaining} codes remaining</span>
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
                  <code key={i} className="text-gray-600 dark:text-gray-400">
                    {code}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
