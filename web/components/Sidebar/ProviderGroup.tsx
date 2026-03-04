'use client'

import { useState, useEffect } from 'react'
import { ProviderId, ProviderConfig, ConnectedProvider, ProviderQuota, formatBytes } from '@/lib/providers/types'

interface ProviderGroupProps {
  provider: ProviderConfig
  accounts: ConnectedProvider[]
  selectedProvider: ProviderId
  activeAccountKey: string
  healthStates: Record<string, { status: string; message?: string }>
  quotas: Record<string, ProviderQuota>
  onNavigate: (providerId: ProviderId, accountKey?: string) => void
  onDrop?: (e: React.DragEvent, providerId: ProviderId, accountKey: string, folderId: string) => void
  isCollapsed: boolean
  dragOverAccount: string | null
  onDragOver: (cacheKey: string | null) => void
}

export default function ProviderGroup({
  provider,
  accounts,
  selectedProvider,
  activeAccountKey,
  healthStates,
  quotas,
  onNavigate,
  onDrop,
  isCollapsed,
  dragOverAccount,
  onDragOver,
}: ProviderGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(`cacheflow:ui:providerGroupExpanded_${provider.id}`)
    if (stored !== null) {
      setIsExpanded(stored === 'true')
    }
  }, [provider.id])

  const toggleExpand = () => {
    const newState = !isExpanded
    setIsExpanded(newState)
    localStorage.setItem(`cacheflow:ui:providerGroupExpanded_${provider.id}`, String(newState))
  }

  const getHealthColor = (status?: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500'
      case 'degraded':
        return 'bg-yellow-500'
      case 'needs_reauth':
        return 'bg-red-500'
      default:
        return 'bg-gray-300'
    }
  }

  const getUsageColor = (percent: number) => {
    if (percent > 90) return 'bg-red-500'
    if (percent > 75) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  const navItemClass = (isActive: boolean, isDragOver?: boolean): string => {
    const base = 'flex items-center gap-3 px-3 py-2 rounded-lg transition-all relative'
    const activeState = isActive
      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
    const dragOver = isDragOver ? 'ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-900/50 scale-[1.02] z-10' : ''
    const collapsed = isCollapsed ? 'justify-center px-0' : ''
    return [base, activeState, dragOver, collapsed].filter(Boolean).join(' ')
  }

  if (accounts.length === 0) {
    return null
  }

  return (
    <div data-testid={`cf-sidebar-provider-group-${provider.id}`} className="space-y-1">
      {/* Provider Group Header - Accordion Toggle */}
      {!isCollapsed && (
        <button
          data-testid={`cf-sidebar-provider-${provider.id}`}
          onClick={toggleExpand}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 dark:hover:text-gray-300 transition-colors group"
        >
          <span className="text-lg">{provider.icon}</span>
          <span className="flex-1 text-left">{provider.name}</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-600 group-hover:text-gray-400">
            {accounts.length}
          </span>
          <svg
            className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Collapsed state shows count badge */}
      {isCollapsed && accounts.length > 0 && (
        <div
          data-testid={`cf-sidebar-provider-${provider.id}`}
          className="relative"
          title={`${provider.name}: ${accounts.length} account${accounts.length > 1 ? 's' : ''}`}
        >
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 group-hover/account:opacity-100 pointer-events-none whitespace-nowrap z-50">
            {provider.name}: {accounts.length}
          </div>
        </div>
      )}

      {/* Provider Accounts - Collapsible */}
      {(isExpanded || isCollapsed) && accounts.map((account, idx) => {
        const cacheKey = `${account.providerId}:${account.accountKey}`
        const health = healthStates[cacheKey]
        const quota = quotas[cacheKey]
        const isDragOver = dragOverAccount === cacheKey
        const usagePercent = quota ? (quota.used / quota.total) * 100 : 0
        const isActive = selectedProvider === provider.id && activeAccountKey === account.accountKey

        return (
          <div
            key={account.accountKey || `${provider.id}-${idx}`}
            className="group/account"
          >
            <button
              data-testid={`cf-sidebar-account-${account.accountKey || idx}`}
              onClick={() => onNavigate(provider.id, account.accountKey)}
              onDragOver={(e) => {
                e.preventDefault()
                onDragOver(cacheKey)
              }}
              onDragLeave={() => onDragOver(null)}
              onDrop={(e) => {
                onDragOver(null)
                onDrop?.(e, provider.id, account.accountKey || '', 'root')
              }}
              className={navItemClass(isActive, isDragOver)}
              title={`${account.displayName}${health?.message ? ` (${health.message})` : ''}`}
            >
              <span className="text-xl">{provider.icon}</span>
              {!isCollapsed && (
                <div className="flex flex-col items-start overflow-hidden flex-1">
                  <div className="flex items-center gap-2 w-full">
                    <span className="truncate flex-1 text-sm">{account.displayName}</span>
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${getHealthColor(health?.status)}`}
                      title={health?.status || 'unknown'}
                    />
                  </div>
                  <span className="truncate w-full text-[10px] text-gray-400 leading-tight">
                    {account.accountEmail}
                  </span>
                </div>
              )}
              {isCollapsed && (
                <div
                  className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${getHealthColor(health?.status)}`}
                />
              )}
            </button>

            {/* Mini Quota Bar (Expanded only) */}
            {!isCollapsed && isExpanded && quota && (
              <div data-testid={`cf-sidebar-quota-account-${account.accountKey}`} className="px-10 mt-1 mb-2">
                <div className="h-1 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getUsageColor(usagePercent)}`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] text-gray-400 mt-0.5">
                  <span>{formatBytes(quota.used)}</span>
                  <span>{Math.round(usagePercent)}%</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
