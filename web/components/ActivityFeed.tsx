'use client'

import { useState, useEffect } from 'react'
import { PROVIDERS, formatBytes } from '@/lib/providers/types'

interface ActivityItem {
  id: string
  action: string
  resource: string
  resource_id: string
  created_at: string
  metadata: {
    fileName?: string
    providerId?: string
    accountKey?: string
    path?: string
    size_bytes?: number
    [key: string]: any
  }
}

export default function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ action: '', provider: '' })

  useEffect(() => {
    async function fetchActivity() {
      const token = localStorage.getItem('cf_token')
      if (!token) return

      try {
        let url = '/api/activity?limit=50'
        if (filter.action) url += `&action=${filter.action}`
        if (filter.provider) url += `&provider=${filter.provider}`

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const body = await res.json()
        if (body.ok) {
          setActivities(body.data.activity)
        }
      } catch (err) {
        console.error('Failed to fetch activity:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchActivity()
  }, [filter])

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      upload: 'Uploaded',
      download: 'Downloaded',
      delete: 'Deleted',
      move: 'Moved',
      copy: 'Copied',
      rename: 'Renamed',
      share: 'Shared',
      remote_connect: 'Connected Drive',
      login: 'Logged In'
    }
    return labels[action] || action
  }

  const getActionIcon = (action: string) => {
    const icons: Record<string, string> = {
      upload: '📤',
      download: '📥',
      delete: '🗑️',
      move: '📦',
      copy: '📄',
      rename: '✏️',
      share: '🔗',
      remote_connect: '☁️',
      login: '🔑'
    }
    return icons[action] || '⚡'
  }

  const getActionTone = (action: string) => {
    const tones: Record<string, string> = {
      upload: 'border-[rgba(74,158,255,0.24)] bg-[rgba(74,158,255,0.1)] text-[var(--cf-blue)]',
      download: 'border-[rgba(0,201,167,0.24)] bg-[rgba(0,201,167,0.1)] text-[var(--cf-teal)]',
      delete: 'border-[rgba(255,92,92,0.24)] bg-[rgba(255,92,92,0.1)] text-[var(--cf-red)]',
      move: 'border-[rgba(255,159,67,0.24)] bg-[rgba(255,159,67,0.1)] text-[var(--cf-amber)]',
      copy: 'border-[rgba(167,139,250,0.24)] bg-[rgba(167,139,250,0.1)] text-[var(--cf-purple)]',
      rename: 'border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] text-[var(--cf-text-1)]',
      share: 'border-[rgba(74,158,255,0.24)] bg-[rgba(74,158,255,0.1)] text-[var(--cf-blue)]',
      remote_connect: 'border-[rgba(0,201,167,0.24)] bg-[rgba(0,201,167,0.1)] text-[var(--cf-teal)]',
      login: 'border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] text-[var(--cf-text-1)]',
    }
    return tones[action] || 'border-[var(--cf-border)] bg-[rgba(255,255,255,0.04)] text-[var(--cf-text-1)]'
  }

  const getActivityHeadline = (item: ActivityItem) => {
    const target = item.metadata.fileName || item.metadata.path || item.resource
    return `${getActionLabel(item.action)} ${target}`
  }

  const getActivityDetail = (item: ActivityItem) => {
    if (item.metadata.path) return item.metadata.path
    if (item.metadata.accountKey) return item.metadata.accountKey
    return item.resource_id || item.resource
  }

  const getProviderMeta = (providerId?: string) => {
    if (!providerId) return null
    return PROVIDERS.find((provider) => provider.id === providerId) || null
  }

  return (
    <div data-testid="cf-activity-feed" className="mx-auto max-w-[1280px] px-5 py-5 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="cf-kicker mb-2">Activity</div>
          <h1 className="text-[1.7rem] font-semibold tracking-[-0.02em] text-[var(--cf-text-0)]">Activity Feed</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--cf-text-1)]">Recent actions across your connected providers and file surfaces.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            data-testid="cf-activity-filter-action"
            value={filter.action}
            onChange={(e) => setFilter(prev => ({ ...prev, action: e.target.value }))}
            className="rounded-lg border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-2 text-[13px] font-medium text-[var(--cf-text-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-[rgba(255,255,255,0.16)] focus:border-[var(--cf-blue)] focus:outline-none"
          >
            <option value="">All Actions</option>
            <option value="upload">Upload</option>
            <option value="download">Download</option>
            <option value="move">Move</option>
            <option value="copy">Copy</option>
            <option value="delete">Delete</option>
          </select>

          <select
            data-testid="cf-activity-filter-provider"
            value={filter.provider}
            onChange={(e) => setFilter(prev => ({ ...prev, provider: e.target.value }))}
            className="rounded-lg border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-2 text-[13px] font-medium text-[var(--cf-text-1)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-[rgba(255,255,255,0.16)] focus:border-[var(--cf-blue)] focus:outline-none"
          >
            <option value="">All Providers</option>
            {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="cf-panel rounded-[22px] px-7 py-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--cf-blue)]" />
          </div>
        </div>
      ) : activities.length === 0 ? (
        <div className="cf-panel rounded-[22px] py-20 text-center">
          <p className="text-sm text-[var(--cf-text-1)]">No recent activity found.</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {activities.map((item, index) => (
            <div key={item.id} className="relative flex gap-3.5">
              {index < activities.length - 1 && (
                <div className="absolute left-[1rem] top-10 h-[calc(100%-0.25rem)] w-px bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))]" />
              )}

              <div className={`relative z-10 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-sm shadow-[0_10px_24px_rgba(0,0,0,0.18)] ${getActionTone(item.action)}`}>
                {getActionIcon(item.action)}
              </div>

              <div
                data-testid={`cf-activity-item-${item.id}`}
                className="cf-panel mb-3 flex-1 rounded-[20px] px-4 py-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-[13px] font-semibold text-[var(--cf-text-0)] sm:text-sm">
                        {getActivityHeadline(item)}
                      </p>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${getActionTone(item.action)}`}>
                        {item.action.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-[var(--cf-text-2)]">
                      {getActivityDetail(item)}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {item.metadata.providerId && (
                        <div className="flex items-center gap-1.5 rounded-full border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-2.5 py-1 text-[11px] text-[var(--cf-text-2)]">
                          <span className="text-xs">{getProviderMeta(item.metadata.providerId)?.icon}</span>
                          <span className="font-medium">
                            {getProviderMeta(item.metadata.providerId)?.name || item.metadata.providerId}
                          </span>
                        </div>
                      )}
                      {item.metadata.size_bytes && (
                        <span className="rounded-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-2.5 py-1 text-[11px] text-[var(--cf-text-2)]">
                          {formatBytes(item.metadata.size_bytes)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-right">
                    <div className="cf-kicker mb-1 text-[9px]">Event Time</div>
                    <div className="text-[11px] text-[var(--cf-text-1)]">
                      {new Date(item.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
