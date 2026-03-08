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
      <div className="space-y-4 animate-pulse">
        <div className="h-28 rounded-[28px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)]" />
        <div className="h-40 rounded-[28px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)]" />
      </div>
    )
  }

  return (
    <div
      data-testid="cf-2fa-panel"
      className="space-y-6 rounded-[28px] border border-[var(--cf-border)] bg-[var(--cf-subpanel-bg)] p-6 shadow-[var(--cf-shadow-elev)]"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${
              settings.enabled
                ? 'border-[rgba(0,201,167,0.24)] bg-[rgba(0,201,167,0.1)]'
                : 'border-[var(--cf-border)] bg-[var(--cf-panel-soft)]'
            }`}
          >
            <svg
              className={`h-6 w-6 ${settings.enabled ? 'text-[var(--cf-teal)]' : 'text-[var(--cf-text-2)]'}`}
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
            <div className="cf-kicker">Authentication Guardrail</div>
            <h3 className="mt-2 text-xl font-semibold text-[var(--cf-text-0)]">Two-Factor Authentication</h3>
            <p className="mt-1 text-sm text-[var(--cf-text-1)]">
              {settings.enabled ? 'Enabled for this account.' : 'Not enabled yet.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
              settings.enabled
                ? 'border-[rgba(0,201,167,0.24)] bg-[rgba(0,201,167,0.08)] text-[var(--cf-teal)]'
                : 'border-[var(--cf-border)] bg-[var(--cf-panel-soft)] text-[var(--cf-text-1)]'
            }`}
          >
            {settings.enabled ? 'Protected' : 'Recommended'}
          </div>
          {settings.enabled && (
            <button
              onClick={handleDisable}
              className="rounded-2xl border border-[rgba(255,92,92,0.26)] bg-[rgba(255,92,92,0.08)] px-4 py-2 text-sm font-medium text-[var(--cf-red)] transition hover:bg-[rgba(255,92,92,0.14)]"
            >
              Disable
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
          <div className="cf-kicker">Status</div>
          <div className={`mt-3 text-2xl font-semibold ${settings.enabled ? 'text-[var(--cf-teal)]' : 'text-[var(--cf-blue)]'}`}>
            {settings.enabled ? 'Enabled' : 'Pending'}
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--cf-text-1)]">
            {settings.enabled
              ? 'Interactive sign-in now requires a secondary code.'
              : 'Enable to protect account access with a time-based code.'}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
          <div className="cf-kicker">Last Used</div>
          <div className="mt-3 text-sm font-semibold text-[var(--cf-text-0)]">
            {settings.lastUsed ? new Date(settings.lastUsed).toLocaleString() : 'No 2FA sign-in yet'}
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--cf-text-1)]">Tracks recent OTP usage only after successful activation.</p>
        </div>
        <div className="rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
          <div className="cf-kicker">Recovery</div>
          <div className="mt-3 text-sm font-semibold text-[var(--cf-text-0)]">
            {settings.backupCodesRemaining !== undefined ? `${settings.backupCodesRemaining} codes remaining` : 'Codes shown during setup'}
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--cf-text-1)]">Backup codes can be copied during setup and viewed again if still cached in memory.</p>
        </div>
      </div>

      {!settings.enabled && !setupState && (
        <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-5">
          <div className="cf-kicker">Activation</div>
          <p className="mt-2 text-sm leading-6 text-[var(--cf-text-1)]">
            Start setup to generate an authenticator secret, display the QR code, and issue one-time backup codes.
          </p>
          <button
            onClick={handleStartSetup}
            className="mt-5 rounded-2xl border border-[rgba(74,158,255,0.28)] bg-[rgba(74,158,255,0.14)] px-4 py-2 text-sm font-semibold text-[var(--cf-blue)] transition hover:bg-[rgba(74,158,255,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isStartingSetup}
          >
            {isStartingSetup ? 'Preparing setup...' : 'Enable Two-Factor Authentication'}
          </button>
        </div>
      )}

      {!settings.enabled && setupState && (
        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <div className="rounded-[24px] border border-[var(--cf-border)] bg-white p-4">
            <div className="cf-kicker text-slate-500">Authenticator QR</div>
            <div className="mt-4 inline-block rounded-2xl border border-slate-200 p-2">
              <img src={setupState.qrCodeUrl} alt="QR Code" className="h-48 w-48" />
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-600">
              Scan with your authenticator app. The secret only needs manual entry if QR scanning is unavailable.
            </p>
          </div>
          <div className="space-y-4">
            <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-5">
              <div className="cf-kicker">Verification</div>
              <p className="mt-2 text-sm leading-6 text-[var(--cf-text-1)]">
                Scan this QR code in your authenticator app, then enter the 6-digit code to activate two-factor authentication.
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verificationCode}
                onChange={event => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                className="mt-5 w-full max-w-xs rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-bg)] px-4 py-3 text-[var(--cf-text-0)] outline-none transition focus:border-[var(--cf-blue)]"
              />
              <div className="mt-4">
                <button
                  onClick={handleVerifySetup}
                  className="rounded-2xl border border-[rgba(0,201,167,0.24)] bg-[rgba(0,201,167,0.12)] px-4 py-2 text-sm font-semibold text-[var(--cf-teal)] transition hover:bg-[rgba(0,201,167,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isVerifyingSetup}
                >
                  {isVerifyingSetup ? 'Verifying...' : 'Verify & Activate'}
                </button>
              </div>
            </div>
          {backupCodes.length > 0 && (
              <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-5">
                <div className="cf-kicker">Backup Codes</div>
                <p className="mt-2 text-sm leading-6 text-[var(--cf-text-1)]">
                  Save these codes somewhere safe. Each code can be used once if your authenticator is unavailable.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, i) => (
                    <code
                      key={i}
                      className="rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-bg)] px-3 py-2 text-[var(--cf-text-1)]"
                    >
                    {code}
                    </code>
                ))}
                </div>
              </div>
          )}
          </div>
        </div>
      )}

      {settings.enabled && (
        <div className="space-y-4">
          <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="cf-kicker">Recovery Controls</div>
                <p className="mt-2 text-sm leading-6 text-[var(--cf-text-1)]">
                  Keep a copy of your backup codes. These are your fallback if your authenticator device is lost.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleGenerateBackupCodes}
                  className="rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-bg)] px-4 py-2 text-sm font-medium text-[var(--cf-text-1)] transition hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
                >
                  View Backup Codes
                </button>
                {settings.backupCodesRemaining !== undefined && (
                  <span className="inline-flex items-center rounded-full border border-[var(--cf-border)] bg-[var(--cf-panel-bg)] px-3 py-1 text-xs font-medium text-[var(--cf-text-1)]">
                    {settings.backupCodesRemaining} codes remaining
                  </span>
                )}
              </div>
            </div>
          </div>

          {showBackupCodes && backupCodes.length > 0 && (
            <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="cf-kicker">Backup Codes</div>
                  <p className="mt-2 text-sm leading-6 text-[var(--cf-text-1)]">Copy these codes to a secure location.</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(backupCodes.join('\n'))
                  }}
                  className="rounded-2xl border border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.08)] px-3 py-2 text-xs font-semibold text-[var(--cf-blue)] transition hover:bg-[rgba(74,158,255,0.14)]"
                >
                  Copy all
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((code, i) => (
                  <code
                    key={i}
                    className="rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-bg)] px-3 py-2 text-[var(--cf-text-1)]"
                  >
                    {code}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-[rgba(255,92,92,0.24)] bg-[rgba(255,92,92,0.08)] px-4 py-3 text-sm text-[var(--cf-red)]">
          {error}
        </div>
      )}
    </div>
  )
}
