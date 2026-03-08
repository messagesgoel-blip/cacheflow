'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { UserSettings } from '@/lib/providers/types'
import { useActionCenter } from '@/components/ActionCenterProvider'

interface SettingsPanelProps {}

const defaultSettings: UserSettings = {
  browserOnlyMode: false,
  autoRefreshTokens: true,
  cacheTTLMinutes: 5,
  theme: 'system',
  defaultUploadProvider: undefined,
}

const themeOptions: Array<UserSettings['theme']> = ['light', 'dark', 'system']
const cacheOptions = [1, 5, 15, 30, 60]

function ToggleSwitch({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 items-center rounded-full border transition ${
        enabled
          ? 'border-[rgba(74,158,255,0.45)] bg-[rgba(74,158,255,0.24)]'
          : 'border-[var(--cf-border)] bg-[var(--cf-panel-soft)]'
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function SettingsCard({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="cf-subpanel rounded-[28px] p-5" data-testid={`cf-settings-card-${kicker.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="cf-kicker">{kicker}</div>
      <div className="mt-3">
        <h2 className="text-lg font-semibold text-[var(--cf-text-0)]">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--cf-text-1)]">{description}</p>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  )
}

function SettingRow({
  title,
  description,
  trailing,
  helper,
}: {
  title: string
  description: string
  trailing: ReactNode
  helper?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--cf-text-0)]">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--cf-text-1)]">{description}</p>
          {helper ? <div className="mt-3">{helper}</div> : null}
        </div>
        <div className="flex-shrink-0">{trailing}</div>
      </div>
    </div>
  )
}

export default function SettingsPanel({}: SettingsPanelProps) {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const actions = useActionCenter()

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cacheflow_settings')
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<UserSettings>
      setSettings((prev) => ({ ...prev, ...parsed }))
    } catch {
      // Keep defaults if saved preferences are invalid.
    }
  }, [])

  const handleToggle = (key: keyof UserSettings) => {
    if (typeof settings[key] === 'boolean') {
      setSettings((prev) => ({ ...prev, [key]: !prev[key] }))
      setSaved(false)
    }
  }

  const handleChange = (key: keyof UserSettings, value: UserSettings[keyof UserSettings]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    localStorage.setItem('cacheflow_settings', JSON.stringify(settings))
    await new Promise((resolve) => setTimeout(resolve, 500))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const browserModeTone = settings.browserOnlyMode
    ? {
        label: 'Private',
        className:
          'border-[rgba(0,201,167,0.24)] bg-[rgba(0,201,167,0.08)] text-[var(--cf-teal)]',
      }
    : {
        label: 'Convenience',
        className:
          'border-[rgba(74,158,255,0.24)] bg-[rgba(74,158,255,0.08)] text-[var(--cf-blue)]',
      }

  return (
    <div className="px-6 py-6 lg:px-8" data-testid="cf-settings-panel">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="cf-kicker">Preference Controls</div>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--cf-text-0)]">Operational defaults</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--cf-text-1)]">
            These values shape browser behavior, cache refresh cadence, and visual theme without changing server-side provider state.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSettings(defaultSettings)}
            className="rounded-2xl border border-[var(--cf-border)] px-4 py-2 text-sm font-medium text-[var(--cf-text-1)] transition hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
          >
            Reset
          </button>
          <button
            type="button"
            data-testid="cf-settings-save"
            onClick={handleSave}
            disabled={saving}
            className="rounded-2xl border border-[rgba(74,158,255,0.28)] bg-[rgba(74,158,255,0.14)] px-4 py-2 text-sm font-semibold text-[var(--cf-blue)] transition hover:bg-[rgba(74,158,255,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
          <div className="cf-kicker">Token Strategy</div>
          <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${browserModeTone.className}`}>
            {browserModeTone.label}
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--cf-text-1)]">
            {settings.browserOnlyMode
              ? 'Credentials stay in the browser only.'
              : 'Encrypted server-side storage remains enabled.'}
          </p>
        </div>
        <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
          <div className="cf-kicker">Refresh</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--cf-teal)]">
            {settings.autoRefreshTokens ? 'Auto' : 'Manual'}
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--cf-text-1)]">OAuth refresh cadence follows your current privacy mode.</p>
        </div>
        <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
          <div className="cf-kicker">Cache TTL</div>
          <div className="mt-3 text-2xl font-semibold text-[var(--cf-amber)]">
            {settings.cacheTTLMinutes >= 60 ? `${settings.cacheTTLMinutes / 60}h` : `${settings.cacheTTLMinutes}m`}
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--cf-text-1)]">Controls how aggressively folder listings refresh from providers.</p>
        </div>
        <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
          <div className="cf-kicker">Theme</div>
          <div className="mt-3 text-2xl font-semibold capitalize text-[var(--cf-purple)]">{settings.theme}</div>
          <p className="mt-3 text-xs leading-5 text-[var(--cf-text-1)]">Updates the visual shell only. No behavior changes.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <SettingsCard
            kicker="Privacy"
            title="Token and session behavior"
            description="Keep the current auth model intact while choosing between convenience and stricter browser-only handling."
          >
            <SettingRow
              title="Browser-only mode"
              description="Keep your OAuth tokens only in browser storage. This avoids server-side token persistence but requires re-authentication if browser data is cleared."
              trailing={
                <ToggleSwitch
                  enabled={settings.browserOnlyMode}
                  onChange={() => handleToggle('browserOnlyMode')}
                />
              }
              helper={
                <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${browserModeTone.className}`}>
                  {settings.browserOnlyMode ? 'Private storage mode' : 'Encrypted server storage'}
                </div>
              }
            />
            <SettingRow
              title="Auto-refresh tokens"
              description="Automatically refresh provider access before expiry to reduce reconnect friction."
              trailing={
                <ToggleSwitch
                  enabled={settings.autoRefreshTokens}
                  onChange={() => handleToggle('autoRefreshTokens')}
                  disabled={settings.browserOnlyMode}
                />
              }
              helper={
                settings.browserOnlyMode ? (
                  <p className="text-xs text-[var(--cf-amber)]">Disabled while browser-only mode is active.</p>
                ) : null
              }
            />
          </SettingsCard>

          <SettingsCard
            kicker="Storage"
            title="Cache and browser data"
            description="These controls affect local cache behavior only. They do not change remote provider contents."
          >
            <SettingRow
              title="Cache duration"
              description="Choose how long file listings and metadata stay warm before the browser asks providers for fresh state."
              trailing={<div className="text-sm font-semibold text-[var(--cf-text-0)]">{settings.cacheTTLMinutes} min</div>}
              helper={
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {cacheOptions.map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => handleChange('cacheTTLMinutes', minutes)}
                      disabled={settings.browserOnlyMode}
                      className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                        settings.cacheTTLMinutes === minutes
                          ? 'border border-[rgba(74,158,255,0.28)] bg-[rgba(74,158,255,0.14)] text-[var(--cf-blue)]'
                          : 'border border-[var(--cf-border)] bg-[var(--cf-panel-bg)] text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]'
                      } ${settings.browserOnlyMode ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                    </button>
                  ))}
                </div>
              }
            />
            <SettingRow
              title="Clear cached data"
              description="Purge locally cached metadata and listings so the next navigation rebuilds state directly from providers."
              trailing={
                <button
                  type="button"
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
                  className="rounded-2xl border border-[var(--cf-border)] px-4 py-2 text-sm font-medium text-[var(--cf-text-1)] transition hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
                >
                  Clear
                </button>
              }
            />
          </SettingsCard>
        </div>

        <SettingsCard
          kicker="Appearance"
          title="Interface theme"
          description="Set the preferred shell theme for this browser session."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {themeOptions.map((theme) => (
              <button
                key={theme}
                type="button"
                onClick={() => handleChange('theme', theme)}
                className={`rounded-[24px] border p-4 text-left transition ${
                  settings.theme === theme
                    ? 'border-[rgba(167,139,250,0.28)] bg-[rgba(167,139,250,0.12)]'
                    : 'border-[var(--cf-border)] bg-[var(--cf-panel-soft)] hover:bg-[var(--cf-hover-bg)]'
                }`}
              >
                <div className="cf-kicker">{theme}</div>
                <div className="mt-3 text-sm font-semibold text-[var(--cf-text-0)]">
                  {theme === 'system' ? 'Match device preference' : `${theme[0].toUpperCase()}${theme.slice(1)} shell`}
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--cf-text-1)]">
                  {theme === 'light'
                    ? 'Higher contrast surfaces with brighter shell backgrounds.'
                    : theme === 'dark'
                      ? 'Dense, low-glare shell optimized for long file sessions.'
                      : 'Follow the active OS appearance setting.'}
                </p>
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
            <div className="cf-kicker">Persistence</div>
            <p className="mt-2 text-sm leading-6 text-[var(--cf-text-1)]">
              Preferences are stored locally in `cacheflow_settings` until server-backed user settings are introduced.
            </p>
          </div>
        </SettingsCard>
      </div>
    </div>
  )
}
