'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import MissionControl from '@/components/MissionControl'
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
          // Connections already processed by tokenManager + server fetch logic
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
        
        <MissionControl />

        <div className="mb-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <OnboardingChecklist connectedProviderCount={connectedProviders.length} />
          <QuickActionsPanel />
        </div>

        <div className="mb-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="cf-panel rounded-[28px] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="cf-kicker mb-2">Command Coverage</div>
                <h2 className="text-lg font-semibold text-[var(--cf-text-0)]">Operational footprint summary</h2>
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
                  label: 'Server Nodes',
                  value: String(vpsCount),
                  helper: 'Managed VPS and SFTP remotes in the active shell.',
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
              <p className="mt-1.5 text-sm text-[var(--cf-text-1)]">Distribution across cloud coverage, server nodes, and quota reporting.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="cf-kicker mb-2 text-[9px]">Quota Coverage</div>
                <div className="mt-2 font-mono text-base font-bold text-[var(--cf-blue)]">
                  {connectedProviders.length > 0 ? `${Math.round((quotaKnownCount / connectedProviders.length) * 100)}%` : '0%'} reported
                </div>
              </div>
              <div className="rounded-[22px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <div className="cf-kicker mb-2 text-[9px]">Storage Remotes</div>
                <div className="mt-2 font-mono text-base font-bold text-[var(--cf-teal)]">
                  {cloudCount} cloud • {vpsCount} server
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="cf-panel rounded-[28px] p-5">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-[var(--cf-border)] pb-4">
              <div>
                <div className="cf-kicker mb-1">Provider Matrix</div>
                <h3 className="text-lg font-semibold text-[var(--cf-text-0)]">Hydrated account handles</h3>
                <p className="mt-1 text-sm text-[var(--cf-text-1)]">Named identities available for fast browsing and routing context.</p>
              </div>
              <div className="rounded-full border border-[var(--cf-border)] px-2.5 py-1 text-[11px] text-[var(--cf-text-2)]">
                {accountLabels.length} tracked
              </div>
            </div>
            
            <div className="grid gap-2.5 sm:grid-cols-2">
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
                <div className="col-span-full rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-4 py-6 text-sm text-[var(--cf-text-2)]">
                  No provider identities are currently hydrated.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <RecentTransfersPanel />
            <RecentActivityPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
