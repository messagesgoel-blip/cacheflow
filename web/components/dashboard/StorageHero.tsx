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

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return 'bg-red-500'
    if (percent >= 75) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  if (connectedProviders.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Storage Connected</h3>
        <p className="text-gray-500 dark:text-gray-400">Connect a cloud provider to see your pooled storage.</p>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 rounded-2xl p-8 shadow-xl text-white overflow-hidden">
      {/* Hero Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold mb-1">Total Pooled Storage</h2>
          <p className="text-blue-200">{connectedProviders.length} provider{connectedProviders.length !== 1 ? 's' : ''} connected</p>
        </div>
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        </div>
      </div>

      {/* Main Stats Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
          <p className="text-blue-200 text-sm mb-1">Used</p>
          <p className="text-2xl font-bold">{formatBytes(aggregateQuota.used)}</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
          <p className="text-blue-200 text-sm mb-1">Total Available</p>
          <p className="text-2xl font-bold">{formatBytes(aggregateQuota.total)}</p>
        </div>
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
          <p className="text-blue-200 text-sm mb-1">Free</p>
          <p className="text-2xl font-bold">{formatBytes(aggregateQuota.total - aggregateQuota.used)}</p>
        </div>
      </div>

      {/* Aggregate Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-blue-100 font-medium">Usage</span>
          <span className="text-blue-100 font-medium">{Math.round(aggregateQuota.percent)}%</span>
        </div>
        <div className="h-4 bg-white/20 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${getUsageColor(aggregateQuota.percent)}`}
            style={{ width: `${Math.min(aggregateQuota.percent, 100)}%` }}
          />
        </div>
      </div>

      {/* Individual Provider Breakdown - Inline */}
      {providersWithQuota.length > 0 && (
        <div className="border-t border-white/20 pt-6">
          <h3 className="text-sm font-semibold text-blue-200 uppercase tracking-wider mb-4">
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
                  className="bg-white/10 backdrop-blur-sm rounded-lg p-4 hover:bg-white/15 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm truncate">
                      {getProviderDisplayName(provider.providerId, provider.displayName, provider.accountEmail)}
                    </span>
                    <span className="text-xs text-blue-200">{Math.round(percent)}%</span>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full ${colorClass}`}
                      style={{ width: `${Math.min(percent, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-blue-200">
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
        <div className="border-t border-white/20 pt-6 mt-6">
          <h3 className="text-sm font-semibold text-blue-200 uppercase tracking-wider mb-3">
            Connected (no storage data)
          </h3>
          <div className="flex flex-wrap gap-2">
            {providersWithoutQuota.map((provider) => (
              <span
                key={provider.providerId}
                className="inline-flex items-center gap-1 px-3 py-1 bg-white/10 rounded-full text-xs"
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

