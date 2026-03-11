'use client'

import { useMemo } from 'react'
import { formatBytes } from '@/lib/providers/types'

interface ProviderInfo {
  providerId: string
  accountKey?: string
  accountEmail?: string
  displayName?: string
  quota?: { used: number; total: number }
}

interface StorageHeroProps {
  connectedProviders: ProviderInfo[]
}

const providerColors: Record<string, string> = {
  google: 'bg-red-500',
  onedrive: 'bg-blue-500',
  dropbox: 'bg-blue-400',
  box: 'bg-blue-600',
  pcloud: 'bg-orange-500',
  filen: 'bg-purple-500',
  yandex: 'bg-red-600',
  vps: 'bg-gray-600',
  webdav: 'bg-green-600',
  local: 'bg-yellow-500'
}

function getProviderDisplayName(providerId: string, displayName?: string, accountEmail?: string): string {
  if (displayName) return displayName
  if (accountEmail) return accountEmail
  return providerId.charAt(0).toUpperCase() + providerId.slice(1)
}

export default function StorageHero({ connectedProviders }: StorageHeroProps) {
  const titleId = 'storage-hero-status-icon'
  const aggregateQuota = useMemo(() => {
    let used = 0
    let total = 0
    for (const cp of connectedProviders) {
      if (cp.quota) {
        used += cp.quota.used
        total += cp.quota.total
      }
    }
    return { used, total, percent: total > 0 ? (used / total) * 100 : 0 }
  }, [connectedProviders])

  const providersWithQuota = useMemo(() => {
    return connectedProviders.filter(p => p.quota && p.quota.total > 0)
  }, [connectedProviders])

  const providersWithoutQuota = useMemo(() => {
    return connectedProviders.filter(p => !p.quota || p.quota.total === 0)
  }, [connectedProviders])
  const topProviders = useMemo(() => {
    return [...providersWithQuota]
      .sort((a, b) => ((b.quota?.used || 0) - (a.quota?.used || 0)))
      .slice(0, 4)
  }, [providersWithQuota])

  const getUsageColor = (percent: number) => {
    if (percent >= 95) return 'bg-red-500'
    if (percent >= 80) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  const getSeverityLabel = (percent: number) => {
    if (percent >= 95) return { text: 'Storage Critical', icon: '🚨', className: 'text-red-400' }
    if (percent >= 80) return { text: 'Storage Low', icon: '⚠️', className: 'text-yellow-400' }
    return null
  }

  if (connectedProviders.length === 0) {
    return (
      <div className="cf-panel rounded-[32px] p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)]">
          <svg className="h-8 w-8 text-[var(--cf-text-2)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold text-[var(--cf-text-0)]">No Storage Connected</h3>
        <p className="text-[var(--cf-text-1)]">Connect a cloud provider to see your pooled storage.</p>
      </div>
    )
  }

  return (
    <div className="cf-liquid overflow-hidden rounded-[34px] p-5 text-[var(--cf-text-0)] shadow-[var(--cf-shadow-strong)] lg:p-6">
      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <div className="cf-panel rounded-[28px] p-4 lg:p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="cf-kicker mb-2">Overview</div>
              <h2 className="mb-1 text-[28px] font-semibold leading-tight">Total Pooled Storage</h2>
              <p className="text-sm text-[var(--cf-text-1)]">{connectedProviders.length} provider{connectedProviders.length !== 1 ? 's' : ''} connected</p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--cf-border-2)] bg-[rgba(74,158,255,0.12)] backdrop-blur-sm">
              <svg aria-labelledby={titleId} role="img" className="h-7 w-7 text-[var(--cf-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <title id={titleId}>Storage usage status</title>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
              <p className="cf-kicker mb-1.5">Used</p>
              <p className="font-mono text-[24px] font-bold text-[var(--cf-teal)]">{formatBytes(aggregateQuota.used)}</p>
            </div>
            <div className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
              <p className="cf-kicker mb-1.5">Total Available</p>
              <p className="font-mono text-[24px] font-bold text-[var(--cf-blue)]">{formatBytes(aggregateQuota.total)}</p>
            </div>
            <div className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
              <p className="cf-kicker mb-1.5">Free</p>
              <p className={`font-mono text-[24px] font-bold ${aggregateQuota.percent >= 80 ? 'text-[var(--cf-amber)]' : 'text-[var(--cf-text-1)]'}`}>{formatBytes(Math.max(0, aggregateQuota.total - aggregateQuota.used))}</p>
            </div>
          </div>
        </div>

        <div className="cf-panel rounded-[28px] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="cf-kicker">Priority Providers</div>
              <div className="mt-1 text-sm text-[var(--cf-text-1)]">Top contributors by used space or live remote presence.</div>
            </div>
            <span className="rounded-full border border-[var(--cf-border)] px-2.5 py-1 text-[11px] text-[var(--cf-text-2)]">
              {Math.min(Math.max(topProviders.length, providersWithoutQuota.length), 4)} shown
            </span>
          </div>
          <div className="space-y-3">
            {(topProviders.length > 0 ? topProviders : providersWithoutQuota.slice(0, 4)).map((provider) => {
              const total = provider.quota?.total || 0
              const used = provider.quota?.used || 0
              const percent = total > 0 ? Math.round((used / total) * 100) : 0
              return (
                <div key={`${provider.providerId}:${provider.accountKey || provider.accountEmail || provider.displayName || 'default'}`} className="rounded-[20px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="truncate text-[13px] font-medium text-[var(--cf-text-0)]">
                      {getProviderDisplayName(provider.providerId, provider.displayName, provider.accountEmail)}
                    </div>
                    <span className="font-mono text-[11px] text-[var(--cf-text-2)]">
                      {total > 0 ? `${percent}%` : 'Live'}
                    </span>
                  </div>
                  {total > 0 ? (
                    <>
                      <div className="mb-2 h-2 overflow-hidden rounded-full bg-[var(--cf-bg3)]">
                        <div
                          className={`h-full ${percent >= 95 ? 'bg-red-500' : percent >= 80 ? 'bg-yellow-500' : (providerColors[provider.providerId] || 'bg-blue-500')}`}
                          style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }}
                        />
                      </div>
                      <div className="flex justify-between font-mono text-[11px] text-[var(--cf-text-2)]">
                        <span>{formatBytes(used)}</span>
                        <span>{formatBytes(Math.max(0, total - used))} free</span>
                      </div>
                    </>
                  ) : (
                    <div className="font-mono text-[11px] text-[var(--cf-text-2)]">
                      Connected with no reported quota telemetry.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="cf-panel rounded-[28px] p-4 lg:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="cf-kicker">Usage</div>
              <div className="mt-1 text-sm text-[var(--cf-text-1)]">Combined quota from providers that report telemetry.</div>
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const severity = getSeverityLabel(aggregateQuota.percent)
                return severity ? (
                  <span className={`text-xs font-medium ${severity.className}`}>
                    {severity.icon} {severity.text}
                  </span>
                ) : null
              })()}
              <span className="rounded-full border border-[var(--cf-border)] px-2.5 py-1 font-mono text-[11px] text-[var(--cf-text-2)]">{Math.round(aggregateQuota.percent)}%</span>
            </div>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[var(--cf-bg3)]">
            <div
              className={`h-full transition-all duration-500 ${getUsageColor(aggregateQuota.percent)}`}
              style={{ width: `${Math.max(0, Math.min(aggregateQuota.percent, 100))}%` }}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Accounts', value: String(connectedProviders.length), accent: 'text-[var(--cf-blue)]' },
              { label: 'Quota-tracked', value: String(providersWithQuota.length), accent: 'text-[var(--cf-teal)]' },
              { label: 'Opaque remotes', value: String(providersWithoutQuota.length), accent: 'text-[var(--cf-amber)]' },
              { label: 'Free headroom', value: formatBytes(Math.max(aggregateQuota.total - aggregateQuota.used, 0)), accent: 'text-[var(--cf-purple)]' },
            ].map((item) => (
              <div key={item.label} className="rounded-[20px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-3.5">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cf-text-3)]">{item.label}</div>
                <div className={`mt-2 truncate font-mono text-base font-bold ${item.accent}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="cf-panel rounded-[28px] p-4">
          <div className="mb-3">
            <div className="cf-kicker">Quota Coverage</div>
            <div className="mt-1 text-sm text-[var(--cf-text-1)]">Operational split between quota-reported accounts and opaque remotes.</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              {
                label: 'Quota-tracked',
                value: String(providersWithQuota.length),
                helper: 'Accounts reporting used and total space.',
                accent: 'text-[var(--cf-teal)]',
              },
              {
                label: 'Opaque remotes',
                value: String(providersWithoutQuota.length),
                helper: 'Live remotes without quota telemetry.',
                accent: 'text-[var(--cf-amber)]',
              },
              {
                label: 'Reporting ratio',
                value: connectedProviders.length > 0 ? `${Math.round((providersWithQuota.length / connectedProviders.length) * 100)}%` : '0%',
                helper: 'Coverage across the current provider footprint.',
                accent: 'text-[var(--cf-blue)]',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-[20px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-3.5">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cf-text-3)]">{item.label}</div>
                <div className={`mt-2 text-[22px] font-semibold ${item.accent}`}>{item.value}</div>
                <p className="mt-1.5 text-xs leading-5 text-[var(--cf-text-2)]">{item.helper}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {providersWithQuota.length > 0 && (
        <div className="mt-5 border-t border-[var(--cf-border)] pt-5">
          <h3 className="cf-kicker mb-3">
            Provider Breakdown
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providersWithQuota.map((provider) => {
              const percent = provider.quota!.total > 0
                ? (provider.quota!.used / provider.quota!.total) * 100
                : 0
              const clampedPercent = Math.max(0, Math.min(percent, 100))
              const colorClass = getUsageColor(percent) === 'bg-red-500' ? 'bg-red-500' : getUsageColor(percent) === 'bg-yellow-500' ? 'bg-yellow-500' : (providerColors[provider.providerId] || 'bg-blue-500')
              const severity = getSeverityLabel(percent)

              return (
                <div
                  key={`${provider.providerId}:${provider.accountKey || provider.accountEmail || provider.displayName || 'default'}`}
                  className="rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-3.5 transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="truncate text-[13px] font-medium">
                      {getProviderDisplayName(provider.providerId, provider.displayName, provider.accountEmail)}
                    </span>
                    <div className="flex items-center gap-2">
                      {severity && (
                        <span className={`text-[10px] font-medium ${severity.className}`}>
                          {severity.icon} {severity.text}
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-[var(--cf-text-2)]">{Math.round(percent)}%</span>
                    </div>
                  </div>
                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-[var(--cf-bg3)]">
                    <div
                      className={`h-full ${colorClass}`}
                      style={{ width: `${clampedPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between font-mono text-[11px] text-[var(--cf-text-1)]">
                    <span>{formatBytes(provider.quota!.used)}</span>
                    <span>{formatBytes(provider.quota!.total)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Providers without quota */}
      {providersWithoutQuota.length > 0 && (
        <div className="mt-5 border-t border-[var(--cf-border)] pt-5">
          <h3 className="cf-kicker mb-3">
            Connected (no storage data)
          </h3>
          <div className="flex flex-wrap gap-2">
            {providersWithoutQuota.map((provider) => (
              <span
                key={`${provider.providerId}:${provider.accountKey || provider.accountEmail || provider.displayName || 'default'}`}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-xs text-[var(--cf-text-1)]"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                {getProviderDisplayName(provider.providerId, provider.displayName, provider.accountEmail)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
