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

  const navItemClass = (isActive: boolean, isDragOver?: boolean) => `
    relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all
    ${isActive
      ? 'border-[rgba(74,158,255,0.34)] bg-[rgba(74,158,255,0.12)] text-[var(--cf-blue)] shadow-[0_0_0_1px_rgba(74,158,255,0.06)]'
      : 'border-transparent text-[var(--cf-text-1)] hover:border-[var(--cf-border)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]'}
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
    if (percent > 90) return 'bg-[var(--cf-red)]'
    if (percent > 75) return 'bg-[var(--cf-amber)]'
    return 'bg-[var(--cf-blue)]'
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
      className={`flex h-full flex-col border-r border-[var(--cf-border)] bg-[var(--cf-sidebar-bg)] transition-all duration-300 ${
        isCollapsed ? 'w-[72px]' : 'w-72'
      }`}
    >
      <div className={`flex items-center p-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <div>
            <span className="block text-sm font-semibold text-[var(--cf-text-0)]">Navigation Grid</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cf-text-2)]">Platform Surface</span>
          </div>
        )}
        <button
          data-testid="cf-sidebar-collapse-toggle"
          onClick={toggleCollapse}
          className="rounded-xl border border-[var(--cf-border)] p-1.5 text-[var(--cf-text-2)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          <svg className={`h-5 w-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {!isCollapsed && aggregateQuota.total > 0 && (
        <div data-testid="cf-sidebar-quota-aggregate" className="mb-4 px-4">
          <div className="rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-bg)] p-4 shadow-[var(--cf-shadow-elev)]">
            <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--cf-text-2)]">
              <span>Total Storage</span>
              <span>{Math.round(aggregateQuota.percent)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--cf-bg3)]">
              <div
                className={`h-full transition-all duration-500 ${getUsageColor(aggregateQuota.percent)}`}
                style={{ width: `${aggregateQuota.percent}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-[10px] text-[var(--cf-text-1)]">
              {formatBytes(aggregateQuota.used)} of {formatBytes(aggregateQuota.total)} used
            </p>
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
            onClick={() => onNavigate(item.id)}
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
                className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--cf-text-3)]"
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
                      title={`${getAccountLabel(account)}${health?.message ? ` (${health.message})` : ''}`}
                    >
                      <span className="text-sm font-bold">{provider.icon}</span>
                      {!isCollapsed && (
                        <div className="flex min-w-0 flex-1 flex-col items-start">
                          <div className="flex w-full items-center gap-2">
                            <span className="flex-1 break-words whitespace-normal text-left text-sm leading-tight">
                              {getAccountLabel(account)}
                            </span>
                            <div className={`h-2 w-2 flex-shrink-0 rounded-full ${getHealthColor(health?.status)}`} title={health?.status || 'unknown'} />
                          </div>
                          {getAccountSubLabel(account) && (
                            <span className="w-full break-words whitespace-normal text-[10px] leading-tight text-[var(--cf-text-2)]">
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
                      <div data-testid={`cf-sidebar-quota-account-${account.accountKey}`} className="mb-2 mt-1 px-10">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--cf-bg3)]">
                          <div
                            className={`h-full ${getUsageColor(usagePercent)}`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                        <div className="mt-0.5 flex justify-between font-mono text-[8px] text-[var(--cf-text-3)]">
                          <span>{formatBytes(quota.used)}</span>
                          <span>{Math.round(usagePercent)}%</span>
                        </div>
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
          className={`flex items-center gap-3 rounded-xl border border-[var(--cf-border)] px-3 py-2 text-[var(--cf-text-1)] transition-colors hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)] ${
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
