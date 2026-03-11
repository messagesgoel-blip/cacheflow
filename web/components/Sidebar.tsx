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
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

const PLATFORM_ITEMS: Array<{
  id: 'all' | 'recent' | 'starred' | 'activity'
  label: string
  icon: string
}> = [
  { id: 'all', label: 'All Files', icon: '▦' },
  { id: 'recent', label: 'Recent', icon: '◎' },
  { id: 'starred', label: 'Starred', icon: '★' },
  { id: 'activity', label: 'Activity Feed', icon: '≋' },
]

export default function Sidebar({
  connectedProviders,
  selectedProvider,
  activeAccountKey,
  onNavigate,
  onDrop,
  mobileOpen = false,
  onMobileOpenChange,
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

  useEffect(() => {
    const stored = localStorage.getItem('cacheflow:ui:sidebarCollapsed')
    if (stored === 'true') {
      setIsCollapsed(true)
    }
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || connectedProviders.length === 0) return

    const fetchData = async () => {
      const newHealth: Record<string, { status: string; message?: string }> = {}
      const newQuotas: Record<string, ProviderQuota> = {}

      for (const cp of connectedProviders) {
        const cacheKey = `${cp.providerId}:${cp.accountKey}`

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
        } catch {}

        try {
          const provider = getProvider(cp.providerId)
          if (provider) {
            const tokens = JSON.parse(localStorage.getItem(`cacheflow_tokens_${cp.providerId}`) || '[]')
            const tokenData = tokens.find((t: any) => t.accountKey === cp.accountKey)
            provider.remoteId = (tokenData as any)?.remoteId
            const quota = await provider.getQuota()
            newQuotas[cacheKey] = quota
          }
        } catch {}
      }

      setHealthStates(newHealth)
      setQuotas(newQuotas)
    }

    void fetchData()
    const interval = setInterval(() => {
      void fetchData()
    }, 900000)
    return () => clearInterval(interval)
  }, [mounted, providerSignature, connectedProviders])

  const aggregateQuota = useMemo(() => {
    let used = 0
    let total = 0
    Object.values(quotas).forEach((q) => {
      used += q.used
      total += q.total
    })
    return { used, total, percent: total > 0 ? (used / total) * 100 : 0 }
  }, [quotas])

  const toggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('cacheflow:ui:sidebarCollapsed', String(newState))
  }

  const providerGroups = PROVIDERS.filter((p) =>
    connectedProviders.some((cp) => cp.providerId === p.id),
  )

  const handleNavigate = (providerId: ProviderId | 'all' | 'recent' | 'starred' | 'activity', accountKey?: string) => {
    onNavigate(providerId, accountKey)
    onMobileOpenChange?.(false)
  }

  const navItemClass = (isActive: boolean, isDragOver?: boolean) => `
    relative flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 transition-all duration-200 backdrop-blur-md
    ${isActive
      ? 'border-[rgba(116,174,252,0.34)] bg-[linear-gradient(180deg,rgba(116,174,252,0.2),rgba(116,174,252,0.08))] text-[var(--cf-blue)] shadow-[0_12px_24px_rgba(24,42,84,0.25)]'
      : 'border-[rgba(255,255,255,0.03)] bg-[rgba(255,255,255,0.02)] text-[var(--cf-text-1)] hover:border-[var(--cf-border)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--cf-text-0)]'}
    ${isDragOver ? 'z-10 scale-[1.02] ring-2 ring-[var(--cf-blue)]' : ''}
    ${isCollapsed ? 'justify-center px-0' : ''}
  `

  const getHealthColor = (status?: string) => {
    switch (status) {
      case 'connected':
        return 'bg-[var(--cf-green)]'
      case 'degraded':
        return 'bg-[var(--cf-amber)]'
      case 'needs_reauth':
        return 'bg-[var(--cf-red)]'
      default:
        return 'bg-[var(--cf-text-3)]'
    }
  }

  const getUsageColor = (percent: number) => {
    if (percent >= 95) return 'bg-[var(--cf-red)]'
    if (percent >= 80) return 'bg-[var(--cf-amber)]'
    return 'bg-[var(--cf-blue)]'
  }

  const getStorageStatusLabel = (percent: number) => {
    if (percent >= 95) return { text: 'Storage Critical', className: 'text-[var(--cf-red)]' }
    if (percent >= 80) return { text: 'Storage Low', className: 'text-[var(--cf-amber)]' }
    return null
  }

  const getAccountLabel = (account: ConnectedProvider) =>
    account.displayName || account.accountEmail || account.accountKey || 'Unnamed connection'

  const getAccountSubLabel = (account: ConnectedProvider) => {
    if (account.providerId === 'vps') {
      if (account.username && account.host) return `${account.username}@${account.host}`
      return account.host || account.username || ''
    }
    const label = getAccountLabel(account)
    if (!account.accountEmail || account.accountEmail === label) return ''
    return account.accountEmail
  }

  if (!mounted) return null

  return (
    <aside
      data-testid="cf-sidebar-root"
      className={`cf-liquid flex h-full min-h-0 w-full flex-col rounded-[30px] bg-[var(--cf-sidebar-bg)] transition-all duration-300 ${
        isCollapsed ? 'md:w-[72px]' : 'md:w-72'
      }`}
    >
      <div className={`flex items-center p-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <div>
            <span className="block text-base font-semibold tracking-[-0.03em] text-[var(--cf-text-0)]">Workspace Dock</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cf-text-2)]">Glass Control Rail</span>
          </div>
        )}
        <button
          onClick={() => onMobileOpenChange?.(!mobileOpen)}
          className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-2 text-[var(--cf-text-2)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)] md:hidden"
          title={mobileOpen ? 'Close dock' : 'Open dock'}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <button
          data-testid="cf-sidebar-collapse-toggle"
          onClick={toggleCollapse}
          className="hidden rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-2 text-[var(--cf-text-2)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)] md:inline-flex"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          <svg className={`h-5 w-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {!isCollapsed && aggregateQuota.total > 0 && (
        <div data-testid="cf-sidebar-quota-aggregate" className="mb-4 px-4">
          <div className="cf-panel rounded-[26px] p-4">
            <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-2)]">
              <span>Total Storage</span>
              <span>{Math.round(aggregateQuota.percent)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--cf-bg3)]">
              <div
                className={`h-full transition-all duration-500 ${getUsageColor(aggregateQuota.percent)}`}
                style={{ width: `${Math.max(0, Math.min(aggregateQuota.percent, 100))}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-[10px] text-[var(--cf-text-1)]">
              {formatBytes(aggregateQuota.used)} of {formatBytes(aggregateQuota.total)} used
            </p>
            {(() => {
              const status = getStorageStatusLabel(aggregateQuota.percent)
              return status ? (
                <p className={`mt-1 font-mono text-[10px] font-semibold ${status.className}`}>{status.text}</p>
              ) : null
            })()}
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {!isCollapsed && (
          <div className="px-3 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cf-text-3)]">
            Platform
          </div>
        )}

        {PLATFORM_ITEMS.map((item) => (
          <button
            key={item.id}
            data-testid={item.id === 'all' ? 'cf-sidebar-node-all-files' : undefined}
            onClick={() => handleNavigate(item.id)}
            className={navItemClass(selectedProvider === item.id)}
            title={item.label}
          >
            <span className="text-base font-bold">{item.icon}</span>
            {!isCollapsed && <span className="text-sm">{item.label}</span>}
          </button>
        ))}

        <div className="my-4 border-t border-[var(--cf-border)]" />

        {providerGroups.map((provider) => (
          <div key={provider.id} className="space-y-1">
            {!isCollapsed && (
              <div
                data-testid={`cf-sidebar-provider-${provider.id}`}
                className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cf-text-3)]"
              >
                {provider.name}
              </div>
            )}

            {connectedProviders
              .filter((cp) => cp.providerId === provider.id)
              .map((account, idx) => {
                const cacheKey = `${account.providerId}:${account.accountKey}`
                const health = healthStates[cacheKey]
                const quota = quotas[cacheKey]
                const isDragOver = dragOverAccount === cacheKey
                const usagePercent = quota && quota.total > 0 ? (quota.used / quota.total) * 100 : 0

                const hasNoUsageData = account.providerId === 'vps' && quota && quota.used === 0 && quota.total === 0

                return (
                  <div key={account.accountKey || `${account.providerId}-${idx}`} className="group/account">
                    <button
                      data-testid={`cf-sidebar-account-${account.accountKey || idx}`}
                      onClick={() => handleNavigate(provider.id, account.accountKey)}
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
                      title={`${getAccountLabel(account)}${health?.message ? ` (${health.message})` : ''}`}
                    >
                      <span className="text-[13px] font-bold leading-none">{provider.icon}</span>
                      {!isCollapsed && (
                        <div className="flex min-w-0 flex-1 flex-col items-start">
                          <div className="flex w-full items-start gap-2">
                            <span className="flex-1 break-words whitespace-normal text-left text-[13px] font-medium leading-[1.2]">
                              {getAccountLabel(account)}
                            </span>
                            <div className={`h-2 w-2 flex-shrink-0 rounded-full ${getHealthColor(health?.status)}`} title={health?.status || 'unknown'} />
                          </div>
                          {getAccountSubLabel(account) && (
                            <span className="mt-0.5 w-full break-words whitespace-normal font-mono text-[10px] leading-tight text-[var(--cf-text-2)]">
                              {getAccountSubLabel(account)}
                            </span>
                          )}
                        </div>
                      )}
                      {isCollapsed && (
                        <div className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border border-[var(--cf-bg0)] ${getHealthColor(health?.status)}`} />
                      )}
                    </button>

                    {!isCollapsed && quota && (
                      <div data-testid={`cf-sidebar-quota-account-${account.accountKey}`} className="mb-2 mt-1 px-9">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--cf-bg3)]">
                          {!hasNoUsageData && (
                            <div
                              className={`h-full ${getUsageColor(usagePercent)}`}
                              style={{ width: `${Math.max(0, Math.min(usagePercent, 100))}%` }}
                            />
                          )}
                        </div>
                        {hasNoUsageData ? (
                          <div className="mt-0.5 text-right font-mono text-[8px] italic tracking-[0.08em] text-[var(--cf-text-3)]">
                            No usage data
                          </div>
                        ) : (
                          <div className="mt-0.5 flex justify-between font-mono text-[8px] tracking-[0.08em] text-[var(--cf-text-3)]">
                            <span>{formatBytes(quota.used)}</span>
                            {(() => {
                              const status = getStorageStatusLabel(usagePercent)
                              return status ? (
                                <span className={status.className}>{status.text}</span>
                              ) : (
                                <span>{Math.round(usagePercent)}%</span>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--cf-border)] p-4">
        <a
          href="/providers"
          className={`cf-toolbar-card flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[var(--cf-text-1)] transition-colors hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)] ${
            isCollapsed ? 'justify-center px-0' : ''
          }`}
          title="Add Provider"
        >
          <span className="text-base font-bold">+</span>
          {!isCollapsed && <span className="text-sm font-medium">Add Provider</span>}
        </a>
      </div>
    </aside>
  )
}
