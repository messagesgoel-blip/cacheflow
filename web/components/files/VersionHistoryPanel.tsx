'use client'

import { useState, useEffect } from 'react'
import { History, RotateCcw, X, Clock, User } from 'lucide-react'

interface FileVersion {
  id: string
  modifiedAt: string
  size?: number
  author?: string
}

interface VersionHistoryPanelProps {
  fileId: string
  fileName: string
  onClose: () => void
  onRestoreSuccess?: () => void
}

export default function VersionHistoryPanel({
  fileId,
  fileName,
  onClose,
  onRestoreSuccess
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<FileVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    fetchVersions()
  }, [fileId])

  async function fetchVersions() {
    setLoading(true)
    try {
      const res = await fetch(`/api/backend/files/${fileId}/versions`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to fetch versions')
      const data = await res.json()
      setVersions(data.versions || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRestore(versionId: string) {
    if (!confirm('Are you sure you want to restore this version? The current version will be overwritten.')) return
    
    setRestoringId(versionId)
    try {
      const res = await fetch(`/api/backend/files/${fileId}/versions/${versionId}/restore`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Restore failed')
      alert('Version restored successfully')
      onRestoreSuccess?.()
    } catch (err) {
      console.error(err)
      alert('Failed to restore version')
    } finally {
      setRestoringId(null)
    }
  }

  function formatSize(bytes?: number) {
    if (!bytes) return 'N/A'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 w-80 shadow-xl">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
        <h3 className="font-semibold flex items-center gap-2">
          <History size={18} className="text-blue-500" />
          Version History
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 border-b border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-500 uppercase font-medium mb-1">Current File</p>
        <p className="text-sm font-medium truncate">{fileName}</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-xs text-gray-500">Loading versions...</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Clock size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">No version history found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {versions.map((version, index) => (
              <div key={version.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ${
                    index === 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {index === 0 ? 'Current' : `Version ${versions.length - index}`}
                  </span>
                  {index !== 0 && (
                    <button
                      onClick={() => handleRestore(version.id)}
                      disabled={!!restoringId}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 disabled:opacity-50"
                    >
                      <RotateCcw size={12} className={restoringId === version.id ? 'animate-spin' : ''} />
                      Restore
                    </button>
                  )}
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
                    <Clock size={14} className="text-gray-400" />
                    {formatDate(version.modifiedAt)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <History size={14} className="text-gray-400" />
                    {formatSize(version.size)}
                  </div>
                  {version.author && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <User size={14} className="text-gray-400" />
                      {version.author}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 text-[10px] text-gray-500 border-t border-gray-200 dark:border-gray-800">
        Versioning availability depends on your storage provider settings.
      </div>
    </div>
  )
}
