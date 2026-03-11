'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { PROVIDERS, formatBytes } from '@/lib/providers/types'

type ActivityItem = {
  id: string
  action: string
  resource: string
  resource_id: string
  created_at: string
  metadata: {
    fileName?: string
    providerId?: string
    path?: string
    size_bytes?: number
  }
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    upload: 'Uploaded',
    download: 'Downloaded',
    delete: 'Deleted',
    move: 'Moved',
    copy: 'Copied',
    rename: 'Renamed',
    share: 'Shared',
    remote_connect: 'Connected',
    login: 'Logged in',
  }

  return labels[action] || action.replace(/_/g, ' ')
}

function actionTone(action: string): string {
  if (action === 'delete') return 'border-[rgba(255,92,92,0.22)] bg-[rgba(255,92,92,0.08)] text-[var(--cf-red)]'
  if (action === 'download') return 'border-[rgba(0,201,167,0.22)] bg-[rgba(0,201,167,0.08)] text-[var(--cf-teal)]'
  if (action === 'move' || action === 'copy') return 'border-[rgba(255,159,67,0.22)] bg-[rgba(255,159,67,0.08)] text-[var(--cf-amber)]'
  return 'border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.08)] text-[var(--cf-blue)]'
}

function providerMeta(providerId?: string) {
  if (!providerId) return null
  return PROVIDERS.find((provider) => provider.id === providerId) || null
}

export default function RecentActivityPanel() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadActivity = async () => {
      try {
        const response = await fetch('/api/backend/activity?limit=4', {
          credentials: 'include',
        })
        const payload = await response.json()
        if (!active) return
        if (payload?.ok) {
          setActivities(Array.isArray(payload.data?.activity) ? payload.data.activity : [])
        }
      } catch (error) {
        console.error('Failed to load dashboard activity:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadActivity()

    return () => {
      active = false
    }
  }, [])

  const items = useMemo(() => activities.slice(0, 3), [activities])

  return (
    <section data-testid="cf-dashboard-recent-activity" className="cf-panel rounded-[28px] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="cf-kicker mb-2">Activity</div>
          <h2 className="text-lg font-semibold text-[var(--cf-text-0)]">Recent control plane events</h2>
          <p className="mt-1.5 text-sm text-[var(--cf-text-1)]">
            Current activity API results, cross-linked into the full files activity workspace.
          </p>
        </div>
        <Link
          href="/files?view=activity"
          data-testid="cf-dashboard-activity-link"
          className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 text-[12px] text-[var(--cf-text-1)] transition hover:border-[rgba(255,255,255,0.16)] hover:text-[var(--cf-text-0)]"
        >
          Open full feed
        </Link>
      </div>

      {loading ? (
        <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-6 text-sm text-[var(--cf-text-2)]">
          Loading recent activity…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-6 text-sm text-[var(--cf-text-2)]">
          No recent activity has been recorded for this session.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const provider = providerMeta(item.metadata.providerId)
            const headline = item.metadata.fileName || item.metadata.path || item.resource || 'Untitled event'

            return (
              <Link
                key={item.id}
                href="/files?view=activity"
                data-testid={`cf-dashboard-activity-${item.id}`}
                className="group block rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4 transition hover:border-[rgba(255,255,255,0.14)] hover:bg-[rgba(255,255,255,0.05)]"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-sm ${actionTone(item.action)}`}>
                    {provider?.icon || '•'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--cf-text-0)]">
                        {actionLabel(item.action)} {headline}
                      </p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${actionTone(item.action)}`}>
                        {item.action.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-[var(--cf-text-2)]">
                      {provider && (
                        <span className="rounded-full border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1">
                          {provider.icon} {provider.name}
                        </span>
                      )}
                      {item.metadata.size_bytes ? (
                        <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1">
                          {formatBytes(item.metadata.size_bytes)}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1">
                        {new Date(item.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <span className="mt-0.5 text-[var(--cf-text-3)] transition group-hover:text-[var(--cf-text-1)]">↗</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
