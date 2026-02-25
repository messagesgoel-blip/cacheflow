'use client'

import { useState, useEffect } from 'react'
import { getStorageLocations, getStorageUsage } from '@/lib/api'

interface StorageLocation {
  id: string
  name: string
  type: 'local' | 'pool' | 'cloud'
  path?: string
  provider?: string
  region?: string | null
  totalSize: number
  fileCount: number
  status: 'active' | 'inactive' | 'unavailable'
  description: string
  color: string
  icon: string
  isActive?: boolean
  configId?: string
  totalBytes?: number | null
  usedBytes?: number | null
  availableBytes?: number | null
}

interface StorageSummary {
  totalFiles: number
  syncedFiles: number
  pendingFiles: number
  syncingFiles: number
  errorFiles: number
  totalSizeBytes: number
  localCacheSize: number
  poolSize: number
}

interface StorageUsage {
  quota: {
    total: number
    used: number
    available: number
    usedPercentage: number
  }
  fileTypes: Array<{
    type: string
    fileCount: number
    totalSize: number
  }>
}

interface DrivePanelProps {
  token: string
  selectedLocationId?: string
  onLocationSelect?: (locationId: string) => void
  onRefresh?: () => void
}

export default function DrivePanel({ token, selectedLocationId: selectedLocationIdProp, onLocationSelect, onRefresh }: DrivePanelProps) {
  const [locations, setLocations] = useState<StorageLocation[]>([])
  const [summary, setSummary] = useState<StorageSummary | null>(null)
  const [usage, setUsage] = useState<StorageUsage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'locations' | 'usage'>('locations')
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      loadStorageData()
    }
  }, [token])

  useEffect(() => {
    if (!locations.length) {
      setSelectedLocationId(null)
      return
    }
    if (!selectedLocationId || !locations.some(location => location.id === selectedLocationId)) {
      setSelectedLocationId(locations[0].id)
      onLocationSelect?.(locations[0].id)
    }
  }, [locations, selectedLocationId, onLocationSelect])

  const activeLocationId = selectedLocationIdProp || selectedLocationId

  async function loadStorageData() {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      const [locationsData, usageData] = await Promise.all([
        getStorageLocations(token),
        getStorageUsage(token)
      ])

      setLocations(locationsData.locations || [])
      setSummary(locationsData.summary || null)
      setUsage(usageData || null)
    } catch (err: any) {
      setError(err.message || 'Failed to load storage data')
      console.error('Failed to load storage data:', err)
    } finally {
      setLoading(false)
    }
  }

  function formatBytes(bytes?: number | null): string {
    if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
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
      case 'local': return 'bg-blue-100 text-blue-800'
      case 'pool': return 'bg-green-100 text-green-800'
      case 'cloud': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  function locationMetrics(location: StorageLocation) {
    const used = Number.isFinite(location.usedBytes as number)
      ? Number(location.usedBytes)
      : Number(location.totalSize || 0)

    const total = Number.isFinite(location.totalBytes as number) && Number(location.totalBytes) > 0
      ? Number(location.totalBytes)
      : null

    const available = Number.isFinite(location.availableBytes as number)
      ? Number(location.availableBytes)
      : (total !== null ? Math.max(total - used, 0) : null)

    const usedPct = total !== null && total > 0 ? Math.min((used / total) * 100, 100) : null

    return { used, total, available, usedPct }
  }

  function safePct(part: number, total: number): string {
    if (!total) return '0.0%'
    return `${((part / total) * 100).toFixed(1)}%`
  }

  const selectedLocation = locations.find(location => location.id === activeLocationId) || null

  if (loading && locations.length === 0) {
    return (
      <div className="border rounded-lg bg-white p-4">
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
    <div className="border rounded-lg bg-white">
      <div className="p-3 border-b flex justify-between items-center">
        <h3 className="font-medium text-gray-700">Storage</h3>
        <button
          onClick={() => {
            loadStorageData()
            onRefresh?.()
          }}
          className="text-xs text-blue-600 hover:text-blue-800"
          disabled={loading}
        >
          ↻
        </button>
      </div>

      {error && (
        <div className="p-3 border-b bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="border-b">
        <div className="flex">
          <button
            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'locations' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('locations')}
          >
            Locations
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'usage' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('usage')}
          >
            Usage
          </button>
        </div>
      </div>

      <div className="p-3">
        {activeTab === 'locations' ? (
          <div className="space-y-3">
            {summary && (
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-gray-50 p-2 rounded text-center">
                  <div className="text-lg font-semibold">{summary.totalFiles}</div>
                  <div className="text-xs text-gray-500">Total Files</div>
                </div>
                <div className="bg-gray-50 p-2 rounded text-center">
                  <div className="text-lg font-semibold">{formatBytes(summary.totalSizeBytes)}</div>
                  <div className="text-xs text-gray-500">Total Size</div>
                </div>
              </div>
            )}

            {locations.map(location => {
              const metrics = locationMetrics(location)
              return (
                <button
                  type="button"
                  key={location.id}
                  className={`w-full text-left p-3 border rounded-lg hover:shadow-sm hover:border-blue-300 ${activeLocationId === location.id ? 'border-blue-400 ring-1 ring-blue-200' : ''}`}
                  onClick={() => {
                    setSelectedLocationId(location.id)
                    onLocationSelect?.(location.id)
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{location.icon}</span>
                      <div>
                        <div className="font-medium text-sm">{location.name}</div>
                        <div className="text-xs text-gray-500">{location.description}</div>
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
                      <div className="font-medium">{formatBytes(metrics.used)} used</div>
                      <div className="text-xs text-gray-500">{metrics.available !== null ? `${formatBytes(metrics.available)} free` : `${location.fileCount} files`}</div>
                    </div>
                  </div>

                  {metrics.usedPct !== null && (
                    <div className="mt-2">
                      <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${metrics.usedPct.toFixed(1)}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {metrics.usedPct.toFixed(1)}% used
                      </div>
                    </div>
                  )}
                </button>
              )
            })}

            {selectedLocation && (
              <div className="p-3 rounded-lg border bg-blue-50 border-blue-200">
                <div className="font-medium text-sm text-blue-800 mb-2">Selected: {selectedLocation.name}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-blue-700">Used</span>
                  <span className="text-right text-blue-900">{formatBytes(locationMetrics(selectedLocation).used)}</span>
                  <span className="text-blue-700">Available</span>
                  <span className="text-right text-blue-900">{formatBytes(locationMetrics(selectedLocation).available)}</span>
                  <span className="text-blue-700">Total Capacity</span>
                  <span className="text-right text-blue-900">{formatBytes(locationMetrics(selectedLocation).total)}</span>
                  <span className="text-blue-700">Files</span>
                  <span className="text-right text-blue-900">{selectedLocation.fileCount}</span>
                  {selectedLocation.region && (
                    <>
                      <span className="text-blue-700">Region</span>
                      <span className="text-right text-blue-900">{selectedLocation.region}</span>
                    </>
                  )}
                  {selectedLocation.path && (
                    <>
                      <span className="text-blue-700">Path</span>
                      <span className="text-right text-blue-900 break-all">{selectedLocation.path}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {locations.length === 0 && !loading && (
              <div className="text-center py-4 text-gray-400 text-sm">
                No storage locations configured
              </div>
            )}
          </div>
        ) : (
          usage ? (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Storage Quota</span>
                  <span className="font-medium">
                    {formatBytes(usage.quota.used)} / {formatBytes(usage.quota.total)}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${Math.min(100, usage.quota.usedPercentage)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{usage.quota.usedPercentage.toFixed(1)}% used</span>
                  <span>{formatBytes(usage.quota.available)} available</span>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">File Types</h4>
                <div className="space-y-2">
                  {usage.fileTypes.map(fileType => (
                    <div key={fileType.type} className="flex items-center justify-between">
                      <span className="text-sm">{fileType.type}</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatBytes(fileType.totalSize)}</div>
                        <div className="text-xs text-gray-500">{fileType.fileCount} files</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {summary && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Storage Locations</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Local Cache</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatBytes(summary.localCacheSize)}</div>
                        <div className="text-xs text-gray-500">{safePct(summary.localCacheSize, summary.totalSizeBytes)} of total</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Read-Only Pool</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">{formatBytes(summary.poolSize)}</div>
                        <div className="text-xs text-gray-500">{safePct(summary.poolSize, summary.totalSizeBytes)} of total</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400 text-sm">
              No usage data available
            </div>
          )
        )}
      </div>

      <div className="p-3 border-t text-xs text-gray-500">
        <div className="flex justify-between">
          <span>{locations.length} locations</span>
          {usage && (
            <span>{usage.quota.usedPercentage.toFixed(1)}% quota used</span>
          )}
        </div>
      </div>
    </div>
  )
}
