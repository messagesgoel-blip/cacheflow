'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Conflict {
  id: string
  filename: string
  detected_at: string
  status: 'unresolved' | 'resolved'
  local_version?: {
    path: string
    size_bytes: number
    modified_at: string
  }
  cloud_version?: {
    path: string
    size_bytes: number
    modified_at: string
  }
}

interface ConflictListProps {
  token: string
}

export default function ConflictList({ token }: ConflictListProps) {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchConflicts()
  }, [token])

  async function fetchConflicts() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/backend/conflicts', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })

      if (res.status === 404) {
        // API endpoint not implemented yet
        setConflicts([])
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch conflicts: ${res.status}`)
      }

      const data = await res.json()
      setConflicts(data.conflicts || data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load conflicts')
    } finally {
      setLoading(false)
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading conflicts...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">Error: {error}</p>
        <button
          onClick={fetchConflicts}
          className="mt-2 text-sm text-red-600 hover:text-red-800"
        >
          Retry
        </button>
      </div>
    )
  }

  if (conflicts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-green-500 text-4xl mb-4">✓</div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No conflicts</h3>
        <p className="text-gray-500">Everything is in sync</p>
      </div>
    )
  }

  const unresolvedCount = conflicts.filter(c => c.status === 'unresolved').length

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">File Conflicts</h2>
          {unresolvedCount > 0 && (
            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
              {unresolvedCount} unresolved
            </span>
          )}
        </div>
        <p className="text-gray-600 text-sm mt-1">
          Conflicts occur when a file has been modified both locally and in the cloud.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-2 pr-4">Filename</th>
              <th className="pb-2 pr-4">Detected At</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {conflicts.map(conflict => (
              <tr key={conflict.id} className="border-b hover:bg-gray-50">
                <td className="py-3 pr-4 font-mono text-xs truncate max-w-xs">
                  {conflict.filename}
                </td>
                <td className="py-3 pr-4 text-gray-600">
                  {formatDate(conflict.detected_at)}
                </td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    conflict.status === 'resolved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {conflict.status}
                  </span>
                </td>
                <td className="py-3">
                  <Link
                    href={`/conflicts/${conflict.id}`}
                    className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded hover:bg-blue-100"
                  >
                    Resolve
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
