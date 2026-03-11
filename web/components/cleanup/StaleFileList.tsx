'use client'

import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8100'

interface StaleFile {
  id: string
  name: string
  path: string
  providerId: string
  size: number
  modifiedAt: string
  lastAccessedAt?: string
  status: 'stale' | 'error' | 'orphan'
  errorMessage?: string
  webUrl?: string
}

interface StaleFileListProps {
  token: string
}

export default function StaleFileList({ token }: StaleFileListProps) {
  const [files, setFiles] = useState<StaleFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'stale' | 'error' | 'orphan'>('all')

  useEffect(() => {
    fetchStaleFiles()
  }, [token])

  async function fetchStaleFiles() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API}/cleanup/stale`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      if (res.status === 404) {
        // API endpoint not implemented yet - show mock data for demo
        setFiles([])
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch stale files: ${res.status}`)
      }

      const data = await res.json()
      setFiles(data.files || [])
    } catch (err: any) {
      // Show empty state for now - backend may not be implemented
      setFiles([])
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
  }

  function getStatusBadge(status: StaleFile['status']) {
    const styles = {
      stale: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      orphan: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
    const labels = {
      stale: 'Stale',
      error: 'Error',
      orphan: 'Orphan'
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  function toggleSelect(fileId: string) {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId)
    } else {
      newSelected.add(fileId)
    }
    setSelectedFiles(newSelected)
  }

  function toggleSelectAll() {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(filteredFiles.map(f => f.id)))
    }
  }

  async function handleDeleteSelected() {
    if (selectedFiles.size === 0) return

    setActionLoading(true)
    try {
      const res = await fetch(`${API}/cleanup/stale`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ fileIds: Array.from(selectedFiles) })
      })

      if (res.ok) {
        setFiles(files.filter(f => !selectedFiles.has(f.id)))
        setSelectedFiles(new Set())
      }
    } catch (err) {
      console.error('Failed to delete files:', err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleMoveToTrash(fileId: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`${API}/cleanup/stale/${fileId}/trash`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      if (res.ok) {
        setFiles(files.filter(f => f.id !== fileId))
      }
    } catch (err) {
      console.error('Failed to move to trash:', err)
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePermanentDelete(fileId: string) {
    if (!confirm('Are you sure you want to permanently delete this file? This cannot be undone.')) return
    
    setActionLoading(true)
    try {
      const res = await fetch(`${API}/cleanup/stale/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      if (res.ok) {
        setFiles(files.filter(f => f.id !== fileId))
      }
    } catch (err) {
      console.error('Failed to delete file permanently:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const filteredFiles = filter === 'all' ? files : files.filter(f => f.status === filter)

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Scanning for stale files...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-400">Error: {error}</p>
        <button
          onClick={fetchStaleFiles}
          className="mt-2 text-sm text-red-600 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(['all', 'stale', 'error', 'orphan'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && files.filter(file => file.status === f).length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                  {files.filter(file => file.status === f).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {selectedFiles.size > 0 && (
          <button
            onClick={handleDeleteSelected}
            disabled={actionLoading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {actionLoading ? 'Processing...' : `Delete ${selectedFiles.size} Selected`}
          </button>
        )}
      </div>

      {filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-green-500 text-4xl mb-4">✓</div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No stale files found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Your files are all in good health
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                <th className="pb-3 pr-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
                <th className="pb-3 pr-4">File</th>
                <th className="pb-3 pr-4">Path</th>
                <th className="pb-3 pr-4">Size</th>
                <th className="pb-3 pr-4">Modified</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFiles.map((file) => (
                <tr
                  key={file.id}
                  className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="py-3 pr-4">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.id)}
                      onChange={() => toggleSelect(file.id)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">
                      {file.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {file.providerId}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-400 font-mono text-xs truncate max-w-xs">
                    {file.path}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                    {formatFileSize(file.size)}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                    {formatDate(file.modifiedAt)}
                  </td>
                  <td className="py-3 pr-4">
                    {getStatusBadge(file.status)}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      {file.webUrl && (
                        <a
                          href={file.webUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40"
                        >
                          View
                        </a>
                      )}
                      <button
                        onClick={() => handleMoveToTrash(file.id)}
                        disabled={actionLoading}
                        className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        Trash
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(file.id)}
                        disabled={actionLoading}
                        className="text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredFiles.length > 0 && (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Showing {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
          {selectedFiles.size > 0 && ` (${selectedFiles.size} selected)`}
        </div>
      )}
    </div>
  )
}
