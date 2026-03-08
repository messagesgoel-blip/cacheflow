'use client'

import { useMemo } from 'react'
import { formatBytes } from '@/lib/providers/types'

interface ProviderInfo {
  providerId: string
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
    if (percent >= 90) return 'bg-red-500'
    if (percent >= 75) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  if (connectedProviders.length === 0) {
    return (
      <div className="cf-panel rounded-[28px] p-8 text-center">
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
    <div className="overflow-hidden rounded-[30px] border border-[var(--cf-border)] bg-[linear-gradient(145deg,rgba(24,29,40,0.98),rgba(11,14,20,0.98))] p-8 text-[var(--cf-text-0)] shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="cf-kicker mb-3">Overview</div>
          <h2 className="mb-1 text-3xl font-bold">Total Pooled Storage</h2>
          <p className="text-[var(--cf-text-1)]">{connectedProviders.length} provider{connectedProviders.length !== 1 ? 's' : ''} connected</p>
        </div>
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--cf-border-2)] bg-[rgba(74,158,255,0.12)] backdrop-blur-sm">
          <svg className="h-10 w-10 text-[var(--cf-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
          <p className="cf-kicker mb-2">Used</p>
          <p className="font-mono text-2xl font-bold text-[var(--cf-teal)]">{formatBytes(aggregateQuota.used)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
          <p className="cf-kicker mb-2">Total Available</p>
          <p className="font-mono text-2xl font-bold text-[var(--cf-blue)]">{formatBytes(aggregateQuota.total)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
          <p className="cf-kicker mb-2">Free</p>
          <p className="font-mono text-2xl font-bold text-[var(--cf-amber)]">{formatBytes(aggregateQuota.total - aggregateQuota.used)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
        <div>
          <div className="mb-3 flex justify-between text-sm">
            <span className="font-medium text-[var(--cf-text-1)]">Usage</span>
            <span className="font-medium text-[var(--cf-text-1)]">{Math.round(aggregateQuota.percent)}%</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-[var(--cf-bg3)]">
            <div
              className={`h-full transition-all duration-500 ${getUsageColor(aggregateQuota.percent)}`}
              style={{ width: `${Math.min(aggregateQuota.percent, 100)}%` }}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Accounts', value: String(connectedProviders.length), accent: 'text-[var(--cf-blue)]' },
              { label: 'Quota-tracked', value: String(providersWithQuota.length), accent: 'text-[var(--cf-teal)]' },
              { label: 'Opaque remotes', value: String(providersWithoutQuota.length), accent: 'text-[var(--cf-amber)]' },
              { label: 'Free headroom', value: formatBytes(Math.max(aggregateQuota.total - aggregateQuota.used, 0)), accent: 'text-[var(--cf-purple)]' },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--cf-text-3)]">{item.label}</div>
                <div className={`mt-2 truncate font-mono text-lg font-bold ${item.accent}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.025)] p-5">
          <div className="cf-kicker mb-4">Priority Providers</div>
          <div className="space-y-4">
            {(topProviders.length > 0 ? topProviders : providersWithoutQuota.slice(0, 4)).map((provider) => {
              const total = provider.quota?.total || 0
              const used = provider.quota?.used || 0
              const percent = total > 0 ? Math.round((used / total) * 100) : 0
              return (
                <div key={`${provider.providerId}:${provider.accountEmail || provider.displayName}`} className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-medium text-[var(--cf-text-0)]">
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
                          className={`h-full ${providerColors[provider.providerId] || 'bg-blue-500'}`}
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between font-mono text-[11px] text-[var(--cf-text-2)]">
                        <span>{formatBytes(used)}</span>
                        <span>{formatBytes(total)}</span>
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

      {providersWithQuota.length > 0 && (
        <div className="border-t border-[var(--cf-border)] pt-6">
          <h3 className="cf-kicker mb-4">
            Provider Breakdown
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {providersWithQuota.map((provider) => {
              const percent = provider.quota!.total > 0
                ? (provider.quota!.used / provider.quota!.total) * 100
                : 0
              const colorClass = providerColors[provider.providerId] || 'bg-blue-500'

              return (
                <div
                  key={provider.providerId}
                  className="rounded-xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4 transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="truncate text-sm font-medium">
                      {getProviderDisplayName(provider.providerId, provider.displayName, provider.accountEmail)}
                    </span>
                    <span className="text-xs text-[var(--cf-text-1)]">{Math.round(percent)}%</span>
                  </div>
                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-[var(--cf-bg3)]">
                    <div
                      className={`h-full ${colorClass}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between font-mono text-xs text-[var(--cf-text-1)]">
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
        <div className="mt-6 border-t border-[var(--cf-border)] pt-6">
          <h3 className="cf-kicker mb-3">
            Connected (no storage data)
          </h3>
          <div className="flex flex-wrap gap-2">
            {providersWithoutQuota.map((provider) => (
              <span
                key={provider.providerId}
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
