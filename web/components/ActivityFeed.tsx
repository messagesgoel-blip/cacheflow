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

  return (
    <div data-testid="cf-activity-feed" className="mx-auto max-w-[1280px] p-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="cf-kicker mb-3">Activity</div>
          <h1 className="text-3xl font-semibold text-[var(--cf-text-0)]">Activity Feed</h1>
          <p className="mt-2 text-sm text-[var(--cf-text-1)]">Recent actions across your connected providers and file surfaces.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            data-testid="cf-activity-filter-action"
            value={filter.action}
            onChange={(e) => setFilter(prev => ({ ...prev, action: e.target.value }))}
            className="rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-1)] focus:border-[var(--cf-blue)] focus:outline-none"
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
            className="rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-1)] focus:border-[var(--cf-blue)] focus:outline-none"
          >
            <option value="">All Providers</option>
            {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="cf-panel rounded-[24px] px-8 py-10 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--cf-blue)]" />
          </div>
        </div>
      ) : activities.length === 0 ? (
        <div className="cf-panel rounded-[24px] py-24 text-center">
          <p className="text-sm text-[var(--cf-text-1)]">No recent activity found.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {activities.map((item, index) => (
            <div key={item.id} className="relative flex gap-4">
              {index < activities.length - 1 && (
                <div className="absolute left-[1.15rem] top-12 h-[calc(100%-1rem)] w-px bg-[var(--cf-border)]" />
              )}

              <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-base ${getActionTone(item.action)}`}>
                {getActionIcon(item.action)}
              </div>

              <div
                key={item.id}
                data-testid={`cf-activity-item-${item.id}`}
                className="cf-panel mb-4 flex-1 rounded-[22px] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-[var(--cf-text-0)]">
                        {getActivityHeadline(item)}
                      </p>
                      <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] ${getActionTone(item.action)}`}>
                        {item.action.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--cf-text-2)]">
                      {getActivityDetail(item)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {item.metadata.providerId && (
                        <div className="flex items-center gap-1.5 rounded-full border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-2 py-1">
                          <span className="text-xs">{PROVIDERS.find(p => p.id === item.metadata.providerId)?.icon}</span>
                          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-2)]">
                            {item.metadata.providerId}
                          </span>
                        </div>
                      )}
                      {item.metadata.size_bytes && (
                        <span className="font-mono text-[10px] text-[var(--cf-text-2)]">
                          {formatBytes(item.metadata.size_bytes)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-3)]">
                      Event Time
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--cf-text-1)]">
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
