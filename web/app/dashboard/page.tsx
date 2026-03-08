'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import StorageHero from '@/components/dashboard/StorageHero'
import OnboardingChecklist from '@/components/dashboard/OnboardingChecklist'
import QuickActionsPanel from '@/components/dashboard/QuickActionsPanel'
import RecentActivityPanel from '@/components/dashboard/RecentActivityPanel'
import RecentTransfersPanel from '@/components/dashboard/RecentTransfersPanel'
import { tokenManager } from '@/lib/tokenManager'
import { ProviderId } from '@/lib/providers/types'
import apiClient from '@/lib/apiClient'

export default function DashboardPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [ready, setReady] = useState(false)
  const [connectedProviders, setConnectedProviders] = useState<Array<{
    providerId: string
    accountEmail: string
    displayName: string
    quota?: { used: number; total: number }
  }>>([])

  useEffect(() => {
    let isMounted = true

    const hydrateSession = async () => {
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!response.ok) {
          if (isMounted) {
            setAuthenticated(false)
            setEmail('')
          }
          return
        }
        const payload = await response.json()
        if (!isMounted) return
        setAuthenticated(Boolean(payload?.authenticated))
        setEmail(payload?.user?.email || '')
      } catch {
        if (isMounted) {
          setAuthenticated(false)
          setEmail('')
        }
      } finally {
        if (isMounted) setReady(true)
      }
    }

    void hydrateSession()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!authenticated) return

    const loadConnections = async () => {
      const providerIds: ProviderId[] = ['google', 'onedrive', 'dropbox', 'box', 'pcloud', 'filen', 'yandex', 'vps', 'webdav', 'local']
      const connected: typeof connectedProviders = []

      for (const pid of providerIds) {
        const tokens = tokenManager.getTokens(pid).filter(t => !t.disabled)
        tokens.forEach((t) => {
          if (t && (t.accessToken || (t as any).remoteId)) {
            connected.push({
              providerId: pid,
              accountEmail: t.accountEmail || '',
              displayName: t.displayName || pid,
              quota: (t as any).quota
            })
          }
        })
      }

      try {
        const result = await apiClient.getConnections()
        if (result.success && result.data) {
          for (const conn of result.data) {
            const existing = connected.find(c => c.providerId === conn.provider)
            if (existing && conn.accountEmail === existing.accountEmail) {
              // Update with server quota if available
              // For now, just use local
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch server connections:', err)
      }

      setConnectedProviders(connected)
    }

    void loadConnections()
  }, [authenticated])

  if (!ready) {
    return (
      <div className="cf-shell-page flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--cf-blue)]" />
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="cf-shell-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-[var(--cf-text-1)]">Please log in to view your dashboard</p>
          <a href="/login" className="rounded-xl border border-[rgba(74,158,255,0.32)] bg-[rgba(74,158,255,0.14)] px-4 py-2 text-[var(--cf-blue)] hover:bg-[rgba(74,158,255,0.2)]">
            Log In
          </a>
        </div>
      </div>
    )
  }

  const providerTypes = Array.from(new Set(connectedProviders.map((provider) => provider.providerId)))
  const vpsCount = connectedProviders.filter((provider) => provider.providerId === 'vps').length
  const cloudCount = Math.max(connectedProviders.length - vpsCount, 0)
  const quotaKnownCount = connectedProviders.filter((provider) => (provider.quota?.total || 0) > 0).length
  const opaqueCount = Math.max(connectedProviders.length - quotaKnownCount, 0)
  const accountLabels = connectedProviders
    .map((provider) => provider.displayName || provider.accountEmail || provider.providerId)
    .slice(0, 6)

  return (
    <div className="cf-shell-page">
      <Navbar email={email} onLogout={() => {
        localStorage.removeItem('cf_token')
        localStorage.removeItem('cf_email')
        window.location.href = '/login'
      }} />
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <div className="mb-6">
          <div className="cf-kicker mb-2">Overview</div>
          <h1 className="text-[28px] font-semibold leading-tight text-[var(--cf-text-0)]">Storage Command Center</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--cf-text-1)]">
            High-signal overview for pooled storage, provider health, and operational movement across your connected providers.
          </p>
        </div>

        <div className="mb-6">
          <StorageHero connectedProviders={connectedProviders} />
        </div>

        <div className="mb-6 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <OnboardingChecklist connectedProviderCount={connectedProviders.length} />
          <QuickActionsPanel />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="cf-panel rounded-[28px] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="cf-kicker mb-2">Command Coverage</div>
                <h2 className="text-lg font-semibold text-[var(--cf-text-0)]">Provider summary density</h2>
              </div>
              <div className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1 text-[11px] text-[var(--cf-text-2)]">
                {providerTypes.length} provider types
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: 'Connected Providers',
                  value: String(connectedProviders.length),
                  helper: 'Accounts online in the current control plane session.',
                  accent: 'text-[var(--cf-blue)]',
                },
                {
                  label: 'Tracked Accounts',
                  value: String(connectedProviders.filter((p) => (p.accountEmail || p.displayName)).length),
                  helper: 'Named identities available for browsing and quota rollup.',
                  accent: 'text-[var(--cf-teal)]',
                },
                {
                  label: 'Cloud Footprint',
                  value: String(cloudCount),
                  helper: 'OAuth-backed storage surfaces currently hydrated.',
                  accent: 'text-[var(--cf-amber)]',
                },
                {
                  label: 'Opaque Remotes',
                  value: String(opaqueCount),
                  helper: 'Connected remotes without quota telemetry.',
                  accent: 'text-[var(--cf-purple)]',
                },
              ].map((card) => (
                <div key={card.label} className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="cf-kicker mb-2">{card.label}</div>
                  <p className={`font-mono text-[26px] font-bold ${card.accent}`}>{card.value}</p>
                  <p className="mt-2 text-sm text-[var(--cf-text-2)]">{card.helper}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="cf-panel rounded-[28px] p-5">
            <div className="mb-4">
              <div className="cf-kicker mb-2">Observed Mix</div>
              <h2 className="text-lg font-semibold text-[var(--cf-text-0)]">Current provider footprint</h2>
              <p className="mt-1.5 text-sm text-[var(--cf-text-1)]">Compact split between cloud coverage, server nodes, and quota telemetry.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="cf-kicker mb-2 text-[9px]">Cloud Providers</div>
                <div className="mt-2 font-mono text-[26px] font-bold text-[var(--cf-blue)]">{cloudCount}</div>
                <p className="mt-2 text-sm text-[var(--cf-text-2)]">OAuth-backed storage accounts.</p>
              </div>
              <div className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="cf-kicker mb-2 text-[9px]">VPS / SFTP</div>
                <div className="mt-2 font-mono text-[26px] font-bold text-[var(--cf-teal)]">{vpsCount}</div>
                <p className="mt-2 text-sm text-[var(--cf-text-2)]">Server-backed remotes connected to the control plane.</p>
              </div>
              <div className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="cf-kicker mb-2 text-[9px]">Quota Telemetry</div>
                <div className="mt-2 font-mono text-[26px] font-bold text-[var(--cf-amber)]">{quotaKnownCount}</div>
                <p className="mt-2 text-sm text-[var(--cf-text-2)]">Accounts reporting size and usage to the dashboard.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="cf-panel rounded-[28px] p-5">
            <div className="mb-4">
              <div className="cf-kicker mb-2">Provider Matrix</div>
              <h2 className="text-lg font-semibold text-[var(--cf-text-0)]">Current provider footprint</h2>
              <p className="mt-1.5 text-sm text-[var(--cf-text-1)]">Compact operational view of cloud, server, and quota-reporting coverage.</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="cf-kicker mb-2 text-[9px]">Live Clouds</div>
                <div className="mt-2 font-mono text-[26px] font-bold text-[var(--cf-blue)]">{cloudCount}</div>
                <p className="mt-2 text-sm text-[var(--cf-text-2)]">OAuth-backed storage accounts currently represented above.</p>
              </div>
              <div className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="cf-kicker mb-2 text-[9px]">Server Nodes</div>
                <div className="mt-2 font-mono text-[26px] font-bold text-[var(--cf-teal)]">{vpsCount}</div>
                <p className="mt-2 text-sm text-[var(--cf-text-2)]">Directly managed VPS and SFTP remotes in the same shell.</p>
              </div>
              <div className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="cf-kicker mb-2 text-[9px]">Identity Labels</div>
                <div className="mt-2 font-mono text-[26px] font-bold text-[var(--cf-amber)]">{accountLabels.length}</div>
                <p className="mt-2 text-sm text-[var(--cf-text-2)]">Named handles surfaced for fast browsing and routing context.</p>
              </div>
            </div>

            <div className="mt-5 rounded-[24px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.025)] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="cf-kicker mb-1 text-[9px]">Tracked Identities</div>
                  <h3 className="text-sm font-semibold text-[var(--cf-text-0)]">Hydrated account handles</h3>
                </div>
                <div className="rounded-full border border-[var(--cf-border)] px-2.5 py-1 text-[11px] text-[var(--cf-text-2)]">
                  {accountLabels.length}
                </div>
              </div>
              <div className="space-y-2.5">
                {accountLabels.length > 0 ? (
                  accountLabels.map((label) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
                      <span className="truncate text-sm text-[var(--cf-text-1)]">{label}</span>
                      <span className="rounded-full border border-[rgba(74,158,255,0.24)] bg-[rgba(74,158,255,0.08)] px-2 py-1 text-[10px] font-medium text-[var(--cf-blue)]">
                        Live
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-sm text-[var(--cf-text-2)]">
                    No provider identities are currently hydrated.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <RecentTransfersPanel />
            <RecentActivityPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
