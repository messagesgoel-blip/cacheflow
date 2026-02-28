'use client'

import { useState } from 'react'
import { UserSettings } from '@/lib/providers/types'
import { useActionCenter } from '@/components/ActionCenterProvider'

interface SettingsPanelProps {
  // TODO: Connect to real settings when backend is ready
  // initialSettings?: UserSettings
  // onSave?: (settings: UserSettings) => void
}

const defaultSettings: UserSettings = {
  browserOnlyMode: false,
  autoRefreshTokens: true,
  cacheTTLMinutes: 5,
  theme: 'system',
  defaultUploadProvider: undefined,
}

export default function SettingsPanel({}: SettingsPanelProps) {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const actions = useActionCenter()

  const handleToggle = (key: keyof UserSettings) => {
    if (typeof settings[key] === 'boolean') {
      setSettings(prev => ({ ...prev, [key]: !prev[key] }))
      setSaved(false)
    }
  }

  const handleChange = (key: keyof UserSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    // TODO: Save to server/localStorage
    // await api.saveSettings(settings)
    localStorage.setItem('cacheflow_settings', JSON.stringify(settings))

    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 500))

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your CacheFlow preferences
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSettings(defaultSettings)}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Privacy Section */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Privacy & Security
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Browser-only Mode */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Browser-only mode
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Keep your OAuth tokens only in your browser&apos;s local storage.
                  Tokens will not be stored on the server.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    settings.browserOnlyMode
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  }`}>
                    {settings.browserOnlyMode ? '🔒 Private' : '☁️ Convenience'}
                  </span>
                </div>
              </div>
              <ToggleSwitch
                enabled={settings.browserOnlyMode}
                onChange={() => handleToggle('browserOnlyMode')}
              />
            </div>

            {!settings.browserOnlyMode && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Default:</strong> Your OAuth tokens are stored on the server (encrypted).
                  This allows faster re-login and background sync.
                  <button
                    onClick={() => handleToggle('browserOnlyMode')}
                    className="ml-1 underline"
                  >
                    Enable browser-only
                  </button>
                </p>
              </div>
            )}

            {settings.browserOnlyMode && (
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> You&apos;ll need to re-authenticate with each provider
                  after clearing browser data or using a different device.
                </p>
              </div>
            )}
          </div>

          {/* Auto-refresh Tokens */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Auto-refresh tokens
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Automatically refresh OAuth tokens before they expire to keep your providers connected.
                </p>
              </div>
              <ToggleSwitch
                enabled={settings.autoRefreshTokens}
                onChange={() => handleToggle('autoRefreshTokens')}
                disabled={settings.browserOnlyMode}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Storage Section */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          Storage & Cache
        </h2>

        <div className="space-y-4">
          {/* Cache TTL */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Cache duration
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  How long to cache file listings before refreshing from providers.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[1, 5, 15, 30, 60].map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => handleChange('cacheTTLMinutes', minutes)}
                  disabled={settings.browserOnlyMode}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    settings.cacheTTLMinutes === minutes
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  } ${settings.browserOnlyMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`}
                </button>
              ))}
            </div>
          </div>

          {/* Clear Cache */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Clear cached data
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Clear all cached file listings and metadata from your browser.
                </p>
              </div>
              <button
                onClick={async () => {
                  const ok = await actions.confirm({
                    title: 'Clear cached data?',
                    message: 'Clear all cached data? This will require reloading file listings.',
                    confirmText: 'Clear',
                    cancelText: 'Cancel',
                  })
                  if (!ok) return
                  localStorage.removeItem('cacheflow_cache')
                  actions.notify({ kind: 'success', title: 'Cache cleared' })
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Appearance Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          Appearance
        </h2>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 dark:text-white">
                Theme
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Choose your preferred color scheme.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => handleChange('theme', theme)}
                className={`py-2 px-3 rounded-lg text-sm font-medium capitalize transition-colors ${
                  settings.theme === theme
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {theme === 'light' && '☀️ '}
                {theme === 'dark' && '🌙 '}
                {theme === 'system' && '💻 '}
                {theme}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          About
        </h2>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl">
              ☁️
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                CacheFlow
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Version 2.0 • Client-Side OAuth Architecture
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            CacheFlow unifies multiple cloud storage providers into a single dashboard.
            Your files never leave your devices — all transfers happen directly between providers in your browser.
          </p>
        </div>
      </section>

      {/* Connected Accounts Section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          Connected Accounts
        </h2>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Connect your cloud storage accounts to access them from CacheFlow. 
            Your credentials are stored securely in your browser.
          </p>
          <a
            href="/providers"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Manage Connected Accounts
          </a>
        </div>
      </section>

      {/* Footer spacing */}
      <div className="h-2" />
    </div>
  )
}

// Toggle Switch Component
interface ToggleSwitchProps {
  enabled: boolean
  onChange: () => void
  disabled?: boolean
}

function ToggleSwitch({ enabled, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
