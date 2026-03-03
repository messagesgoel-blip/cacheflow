'use client'

import { useMemo } from 'react'
import { formatBytes } from '@/lib/providers/types'

interface StorageHeroProps {
  connectedProviders: Array<{
    providerId: string
    quota?: { used: number; total: number }
  }>
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
    <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 shadow-lg text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">Total Storage</h2>
          <p className="text-blue-200">{connectedProviders.length} provider{connectedProviders.length !== 1 ? 's' : ''} connected</p>
        </div>
        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-blue-100">{formatBytes(aggregateQuota.used)} used</span>
          <span className="text-blue-100">{formatBytes(aggregateQuota.total)} total</span>
        </div>
        <div className="h-4 bg-white/20 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${getUsageColor(aggregateQuota.percent)}`}
            style={{ width: `${Math.min(aggregateQuota.percent, 100)}%` }}
          />
        </div>
      </div>

      <div className="text-center">
        <span className="text-3xl font-bold">{Math.round(aggregateQuota.percent)}%</span>
        <span className="text-blue-200 ml-2">used</span>
      </div>
    </div>
  )
}
