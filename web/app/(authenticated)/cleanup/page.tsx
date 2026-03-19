'use client'

import { useState, useEffect } from 'react'
import DuplicateGroup from '@/components/cleanup/DuplicateGroup'
import StaleFileList from '@/components/cleanup/StaleFileList'
import { formatFileSize } from '@/lib/utils/format'
import { useClientSession } from '@/lib/auth/clientSession'

interface DuplicateGroupItem {
  signature: string
  fileName: string
  fileSize: number
  files: {
    id: string
    providerId: string
    name: string
    size: number
    parentId: string
    path: string
    mimeType: string
    modifiedAt: string
    webUrl?: string
  }[]
}

type TabType = 'duplicates' | 'stale'

export default function CleanupPage() {
  const { authenticated, email, loading } = useClientSession({ redirectTo: '/login?reason=session_expired' })
  const [activeTab, setActiveTab] = useState<TabType>('duplicates')
  const [duplicates, setDuplicates] = useState<DuplicateGroupItem[]>([])
  const [duplicatesLoading, setDuplicatesLoading] = useState(true)
  const [duplicatesError, setDuplicatesError] = useState<string | null>(null)
  const [scanOptions, setScanOptions] = useState({
    minSize: 1024,
    includeTrash: false,
    recursive: true
  })
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    if (authenticated) {
      void fetchDuplicates()
    }
  }, [authenticated])

  async function fetchDuplicates(options?: typeof scanOptions) {
    setDuplicatesLoading(true)
    setDuplicatesError(null)

    const params = new URLSearchParams()
    if (options?.minSize) params.set('minSize', String(options.minSize))
    if (options?.includeTrash) params.set('includeTrash', 'true')
    if (options?.recursive) params.set('recursive', 'true')

    try {
      const res = await fetch(`/api/backend/cleanup/duplicates?${params}`, {
        credentials: 'include',
      })

      if (res.status === 404) {
        // API endpoint not implemented yet
        setDuplicates([])
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch duplicates: ${res.status}`)
      }

      const data = await res.json()
      setDuplicates(data.duplicates || [])
    } catch (err: any) {
      setDuplicatesError(err.message || 'Failed to load duplicates')
    } finally {
      setDuplicatesLoading(false)
    }
  }

  function handleScan() {
    if (!authenticated) return
    setScanning(true)
    fetchDuplicates(scanOptions).finally(() => setScanning(false))
  }

  function handleDeleteDuplicate(fileId: string) {
    // Remove the file from all groups
    setDuplicates(groups =>
      groups
        .map(group => ({
          ...group,
          files: group.files.filter(f => f.id !== fileId)
        }))
        .filter(group => group.files.length > 1)
    )
  }

  function handleKeepDuplicate(fileId: string) {
    // Move the kept file to be first in its group (mark as newest)
    setDuplicates(groups =>
      groups.map(group => {
        const keptIndex = group.files.findIndex(f => f.id === fileId)
        if (keptIndex === -1 || keptIndex === 0) return group

        const newFiles = [...group.files]
        const [kept] = newFiles.splice(keptIndex, 1)
        return { ...group, files: [kept, ...newFiles] }
      })
    )
  }



  const totalWastedSpace = duplicates.reduce((total, group) => {
    return total + (group.files.length - 1) * group.fileSize
  }, 0)

  const totalDuplicateFiles = duplicates.reduce((total, group) => {
    return total + group.files.length
  }, 0)

  if (loading || !authenticated) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow">
          {/* Header */}
          <div className="p-6 border-b dark:border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                  Storage Cleanup
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                  Find and remove duplicate files and stale data across your storage providers
                </p>
              </div>
              <a
                href="/"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← Back to Files
              </a>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
              <button
                onClick={() => setActiveTab('duplicates')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'duplicates'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                Duplicates
                {duplicates.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs">
                    {duplicates.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('stale')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'stale'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                Stale Files
              </button>
            </div>
          </div>

          {/* Duplicates Tab */}
          {activeTab === 'duplicates' && (
            <div className="p-6">
              {/* Scan Options */}
              <div className="mb-6 p-4 dark:bg-gray-700/50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Scan Options
                </h3>
                <div className="flex flex-wrap gap-4 items-center">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Minimum file size
                    </label>
                    <select
                      value={scanOptions.minSize}
                      onChange={(e) => setScanOptions({ ...scanOptions, minSize: Number(e.target.value) })}
                      className="px-3 py-1.5 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value={0}>Any size</option>
                      <option value={1024}>1 KB</option>
                      <option value={10240}>10 KB</option>
                      <option value={102400}>100 KB</option>
                      <option value={1048576}>1 MB</option>
                      <option value={10485760}>10 MB</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="includeTrash"
                      checked={scanOptions.includeTrash}
                      onChange={(e) => setScanOptions({ ...scanOptions, includeTrash: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <label htmlFor="includeTrash" className="text-sm text-gray-600 dark:text-gray-400">
                      Include trash
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="recursive"
                      checked={scanOptions.recursive}
                      onChange={(e) => setScanOptions({ ...scanOptions, recursive: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <label htmlFor="recursive" className="text-sm text-gray-600 dark:text-gray-400">
                      Scan subfolders
                    </label>
                  </div>

                  <button
                    onClick={handleScan}
                    disabled={scanning}
                    className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {scanning ? 'Scanning...' : 'Rescan'}
                  </button>
                </div>
              </div>

              {/* Summary */}
              {duplicates.length > 0 && (
                <div className="mb-6 flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Found {duplicates.length} duplicate groups ({totalDuplicateFiles} files)
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Potential space savings: {formatFileSize(totalWastedSpace)}
                    </p>
                  </div>
                </div>
              )}

              {/* Loading state */}
              {duplicatesLoading && (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">Scanning for duplicates...</p>
                </div>
              )}

              {/* Error state */}
              {duplicatesError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-700 dark:text-red-400">{duplicatesError}</p>
                  <button
                    onClick={() => authenticated && fetchDuplicates()}
                    className="mt-2 text-sm text-red-600 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Empty state */}
              {!duplicatesLoading && !duplicatesError && duplicates.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-green-500 text-4xl mb-4">✓</div>
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    No duplicates found
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Your storage is optimized
                  </p>
                </div>
              )}

              {/* Duplicate groups */}
              {!duplicatesLoading && !duplicatesError && duplicates.length > 0 && (
                <div>
                  {duplicates.map((group) => (
                    <DuplicateGroup
                      key={group.signature}
                      group={group}
                      onDelete={handleDeleteDuplicate}
                      onKeep={handleKeepDuplicate}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stale Files Tab */}
          {activeTab === 'stale' && (
            <div className="p-6">
              <StaleFileList />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
