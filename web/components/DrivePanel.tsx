'use client'

import { useState, useEffect } from 'react'
import { tokenManager, type StoredToken } from '@/lib/tokenManager'
import { getProvider } from '@/lib/providers'
import { PROVIDERS, ProviderId } from '@/lib/providers/types'

interface StorageLocation {
  id: string
  name: string
  type: 'cloud'
  provider?: string
  totalSize: number
  fileCount: number
  status: 'active' | 'inactive' | 'unavailable'
  description: string
  color: string
  icon: string
}

interface DrivePanelProps {
  token: string
  onLocationSelect?: (locationId: string) => void
  onRefresh?: () => void
}

export default function DrivePanel({ token, onLocationSelect, onRefresh }: DrivePanelProps) {
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [loading, setLoading] = useState(false)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      loadStorageData()
    }
  }, [token])

  async function loadStorageData() {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      const cloudProviders = await getCloudProvidersWithQuotas()
      setLocations(cloudProviders)
    } catch (err: any) {
      setError(err.message || 'Failed to load storage data')
      console.error('Failed to load storage data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function getCloudProvidersWithQuotas(): Promise<StorageLocation[]> {
    if (typeof window === 'undefined') return []
    
    const providerIds: ProviderId[] = ['google', 'onedrive', 'dropbox', 'box', 'pcloud', 'filen', 'yandex']
    const locationsWithTokens: Array<{ pid: ProviderId; token: StoredToken; config: any }> = []

    for (const pid of providerIds) {
      const tokens = tokenManager.getTokens(pid).filter(t => !t.disabled)
      tokens.forEach((t) => {
        if (t && (t.accessToken || t.remoteId)) {
          const providerConfig = PROVIDERS.find(p => p.id === pid)
          locationsWithTokens.push({ pid, token: t, config: providerConfig })
        }
      })
    }

    // Fetch quotas in parallel
    setQuotaLoading(true)
    const quotaResults = await Promise.allSettled(
      locationsWithTokens.map(async ({ pid, token }) => {
        const provider = getProvider(pid)
        if (provider) {
          provider.remoteId = token.remoteId
          return await provider.getQuota()
        }
        return { used: 0, total: 0, free: 0, usedDisplay: '0 B', totalDisplay: '0 B', freeDisplay: '0 B', percentUsed: 0 }
      })
    )
    setQuotaLoading(false)

    // Build locations array with quotas
    const cloudLocations: StorageLocation[] = locationsWithTokens.map(({ pid, token: t, config }, index) => {
      const quotaResult = quotaResults[index]
      let quota = { used: 0, total: 0 }
      
      if (quotaResult.status === 'fulfilled') {
        quota = { used: quotaResult.value.used, total: quotaResult.value.total }
      }
      
      return {
        id: `cloud-${pid}-${index}`,
        name: config?.name || pid,
        type: 'cloud',
        provider: pid,
        totalSize: quota.total,
        fileCount: 0,
        status: 'active' as const,
        description: t.accountEmail || 'Cloud storage',
        color: config?.color || '#4285F4',
        icon: config?.icon || '☁️'
      }
    })

    return cloudLocations
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-yellow-100 text-yellow-800'
      case 'unavailable': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  function getTypeColor(type: string): string {
    switch (type) {
      case 'cloud': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading && locations.length === 0) {
    return (
      <div className="border rounded-lg bg-white dark:bg-gray-800 p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="p-3 border-b dark:border-gray-700 flex justify-between items-center">
        <h3 className="font-medium text-gray-700 dark:text-gray-200">Cloud Storage</h3>
        <button
          onClick={() => {
            loadStorageData()
            onRefresh?.()
          }}
          className="text-xs text-blue-600 hover:text-blue-800"
          disabled={loading}
        >
          {loading ? '↻' : '↻'}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-3 border-b dark:border-gray-700 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Content - Cloud Providers Only */}
      <div className="p-3">
        <div className="space-y-3">
          {/* Cloud providers list */}
          {locations.map(location => (
            <div
              key={location.id}
              className={`p-3 border rounded-lg hover:shadow-sm cursor-pointer dark:border-gray-700 ${onLocationSelect ? 'hover:border-blue-300 dark:hover:border-blue-600' : ''}`}
              onClick={() => onLocationSelect?.(location.id)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{location.icon}</span>
                  <div>
                    <div className="font-medium text-sm dark:text-gray-200">{location.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{location.description}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${getStatusColor(location.status)}`}>
                  {location.status}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className={`text-xs px-2 py-1 rounded ${getTypeColor(location.type)}`}>
                  {location.type}
                </span>
                <div className="text-right">
                  {quotaLoading ? (
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-16 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-12"></div>
                    </div>
                  ) : (
                    <>
                      <div className="font-medium dark:text-gray-200">{formatBytes(location.totalSize)}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{location.fileCount} files</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {locations.length === 0 && !loading && (
            <div className="text-center py-4 text-gray-400 text-sm">
              No cloud providers connected
            </div>
          )}

          {/* Add Provider Button */}
          <a
            href="/providers"
            className="mt-3 flex items-center justify-center gap-2 w-full py-2 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Cloud Provider
          </a>
        </div>
      </div>
    </div>
  )
}
