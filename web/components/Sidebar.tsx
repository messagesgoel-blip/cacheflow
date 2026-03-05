'use client'

import { useState, useEffect, useMemo } from 'react'
import { ProviderId, PROVIDERS, ConnectedProvider, ProviderQuota, formatBytes } from '@/lib/providers/types'
import { getProvider } from '@/lib/providers'

interface SidebarProps {
  connectedProviders: ConnectedProvider[]
  selectedProvider: ProviderId | 'all' | 'recent' | 'starred' | 'activity'
  activeAccountKey: string
  onNavigate: (providerId: ProviderId | 'all' | 'recent' | 'starred' | 'activity', accountKey?: string) => void
  onDrop?: (e: React.DragEvent, providerId: ProviderId, accountKey: string, folderId: string) => void
}

export default function Sidebar({
  connectedProviders,
  selectedProvider,
  activeAccountKey,
  onNavigate,
  onDrop,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setIsMounted] = useState(false)
  const [dragOverAccount, setDragOverAccount] = useState<string | null>(null)
  const [healthStates, setHealthStates] = useState<Record<string, { status: string, message?: string }>>({})
  const [quotas, setQuotas] = useState<Record<string, ProviderQuota>>({})
  const providerSignature = useMemo(
    () => connectedProviders
      .map((cp) => `${cp.providerId}:${cp.accountKey || ''}`)
      .sort()
      .join('|'),
    [connectedProviders],
  )

  // Load collapse state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('cacheflow:ui:sidebarCollapsed')
    if (stored === 'true') {
      setIsCollapsed(true)
    }
    setIsMounted(true)
  }, [])

  // Fetch health and quotas lazily
  useEffect(() => {
    if (!mounted || connectedProviders.length === 0) return

    const fetchData = async () => {
      // Use cookie-based auth (HttpOnly) - no client-side token needed
      const newHealth: Record<string, any> = {}
      const newQuotas: Record<string, ProviderQuota> = {}

      for (const cp of connectedProviders) {
        const cacheKey = `${cp.providerId}:${cp.accountKey}`

        // 1. Health - use credentials: include for cookies
        try {
          const tokens = JSON.parse(localStorage.getItem(`cacheflow_tokens_${cp.providerId}`) || '[]')
          const token = tokens.find((t: any) => t.accountKey === cp.accountKey)
          if (token?.remoteId) {
            const res = await fetch(`/api/remotes/${token.remoteId}/health`, {
              credentials: 'include',
            })
            const body = await res.json()
            if (body.ok) newHealth[cacheKey] = body.data
          }
        } catch (e) {}

        // 2. Quota (from local provider instance)
        try {
          const provider = getProvider(cp.providerId)
          if (provider) {
            const tokens = JSON.parse(localStorage.getItem(`cacheflow_tokens_${cp.providerId}`) || '[]')
            const tokenData = tokens.find((t: any) => t.accountKey === cp.accountKey)
            provider.remoteId = (tokenData as any)?.remoteId
            
            const quota = await provider.getQuota()
            newQuotas[cacheKey] = quota
          }
        } catch (e) {}
      }
      
      setHealthStates(newHealth)
      setQuotas(newQuotas)
    }

    fetchData()
    const interval = setInterval(fetchData, 900000) // Every 15 mins
    return () => clearInterval(interval)
  }, [mounted, providerSignature])

  // Aggregate Quota computed
  const aggregateQuota = useMemo(() => {
    let used = 0
    let total = 0
    Object.values(quotas).forEach(q => {
      used += q.used
      total += q.total
    })
    return { used, total, percent: total > 0 ? (used / total) * 100 : 0 }
  }, [quotas])

  // Persist collapse state
  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('cacheflow:ui:sidebarCollapsed', String(newState))
  }

  if (!mounted) return null

  const providerGroups = PROVIDERS.filter(p => 
    connectedProviders.some(cp => cp.providerId === p.id)
  )

  const navItemClass = (isActive: boolean, isDragOver?: boolean) => `
    flex items-center gap-3 px-3 py-2 rounded-lg transition-all relative
    ${isActive 
      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium' 
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'}
    ${isDragOver ? 'ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-900/50 scale-[1.02] z-10' : ''}
    ${isCollapsed ? 'justify-center px-0' : ''}
  `

  const getHealthColor = (status?: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500'
      case 'degraded': return 'bg-yellow-500'
      case 'needs_reauth': return 'bg-red-500'
      default: return 'bg-gray-300'
    }
  }

  const getUsageColor = (percent: number) => {
    if (percent > 90) return 'bg-red-500'
    if (percent > 75) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  return (
    <aside 
      data-testid="cf-sidebar-root"
      className={`
        flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300
        ${isCollapsed ? 'w-[64px]' : 'w-64'}
      `}
    >
      {/* Header / Toggle */}
      <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            CacheFlow
          </span>
        )}
        <button
          data-testid="cf-sidebar-collapse-toggle"
          onClick={toggleCollapse}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          <svg className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Aggregate Quota Widget */}
      {!isCollapsed && aggregateQuota.total > 0 && (
        <div data-testid="cf-sidebar-quota-aggregate" className="px-6 mb-4">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
              <span>Total Storage</span>
              <span>{Math.round(aggregateQuota.percent)}%</span>
            </div>
            <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${getUsageColor(aggregateQuota.percent)}`}
                style={{ width: `${aggregateQuota.percent}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5 font-medium">
              {formatBytes(aggregateQuota.used)} of {formatBytes(aggregateQuota.total)} used
            </p>
          </div>
        </div>
      )}

      {/* Main Nav */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-1 py-2">
        <button
          data-testid="cf-sidebar-node-all-files"
          onClick={() => onNavigate('all')}
          className={navItemClass(selectedProvider === 'all')}
          title="All Files"
        >
          <span className="text-xl">📁</span>
          {!isCollapsed && <span>All Files</span>}
        </button>

        <button
          onClick={() => onNavigate('recent')}
          className={navItemClass(selectedProvider === 'recent')}
          title="Recent"
        >
          <span className="text-xl">🕒</span>
          {!isCollapsed && <span>Recent</span>}
        </button>

        <button
          onClick={() => onNavigate('starred')}
          className={navItemClass(selectedProvider === 'starred')}
          title="Starred"
        >
          <span className="text-xl">⭐</span>
          {!isCollapsed && <span>Starred</span>}
        </button>

        <button
          onClick={() => onNavigate('activity')}
          className={navItemClass(selectedProvider === 'activity')}
          title="Activity"
        >
          <span className="text-xl">⚡</span>
          {!isCollapsed && <span>Activity Feed</span>}
        </button>

        <div className="my-4 border-t border-gray-100 dark:border-gray-800" />

        {/* Provider Groups */}
        {providerGroups.map(provider => (
          <div key={provider.id} className="space-y-1">
            {!isCollapsed && (
              <div 
                data-testid={`cf-sidebar-provider-${provider.id}`}
                className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider"
              >
                {provider.name}
              </div>
            )}
            
            {connectedProviders
              .filter(cp => cp.providerId === provider.id)
              .map((account, idx) => {
                const cacheKey = `${account.providerId}:${account.accountKey}`
                const health = healthStates[cacheKey]
                const quota = quotas[cacheKey]
                const isDragOver = dragOverAccount === cacheKey
                const usagePercent = quota ? (quota.used / quota.total) * 100 : 0

                return (
                  <div key={account.accountKey || `${account.providerId}-${idx}`} className="group/account">
                    <button
                      data-testid={`cf-sidebar-account-${account.accountKey || idx}`}
                      onClick={() => onNavigate(provider.id, account.accountKey)}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOverAccount(cacheKey)
                      }}
                      onDragLeave={() => setDragOverAccount(null)}
                      onDrop={(e) => {
                        setDragOverAccount(null)
                        onDrop?.(e, provider.id, account.accountKey || '', 'root')
                      }}
                      className={navItemClass(selectedProvider === provider.id && activeAccountKey === account.accountKey, isDragOver)}
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
                    {!isCollapsed && quota && (
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
              })
            }
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <a
          href="/providers"
          className={`
            flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
            ${isCollapsed ? 'justify-center px-0' : ''}
          `}
          title="Add Provider"
        >
          <span className="text-xl">➕</span>
          {!isCollapsed && <span className="text-sm font-medium">Add Provider</span>}
        </a>
      </div>
    </aside>
  )
}
