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

  return (
    <div data-testid="cf-activity-feed" className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Activity Feed</h1>
          <p className="text-sm text-gray-500 mt-1">Recent actions across all your drives</p>
        </div>
        
        <div className="flex gap-2">
          <select 
            data-testid="cf-activity-filter-action"
            value={filter.action}
            onChange={(e) => setFilter(prev => ({ ...prev, action: e.target.value }))}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
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
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            <option value="">All Providers</option>
            {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : activities.length === 0 ? (
        <div className="py-24 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-gray-500">No recent activity found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((item) => (
            <div 
              key={item.id} 
              data-testid={`cf-activity-item-${item.id}`}
              className="flex items-start gap-4 p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl hover:shadow-sm transition-shadow"
            >
              <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-lg flex-shrink-0">
                {getActionIcon(item.action)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {getActionLabel(item.action)} {item.metadata.fileName || item.metadata.path || item.resource}
                  </p>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap uppercase font-bold tracking-tighter">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>
                
                <div className="mt-1 flex items-center gap-3">
                  {item.metadata.providerId && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{PROVIDERS.find(p => p.id === item.metadata.providerId)?.icon}</span>
                      <span className="text-[10px] text-gray-500 uppercase font-medium">
                        {item.metadata.providerId}
                      </span>
                    </div>
                  )}
                  {item.metadata.size_bytes && (
                    <span className="text-[10px] text-gray-400">• {formatBytes(item.metadata.size_bytes)}</span>
                  )}
                  {item.metadata.path && (
                    <span className="text-[10px] text-gray-400 truncate max-w-xs">• {item.metadata.path}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

