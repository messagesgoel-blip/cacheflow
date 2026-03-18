'use client'

import { useState, useEffect } from 'react'
import { Trash2, RotateCcw, XCircle, Info } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'

interface TrashedFile {
  id: string
  name: string
  providerId: string
  size: number
  trashedAt?: string
  originalPath?: string
  isFolder: boolean
}

export default function TrashPage() {
  const [files, setFiles] = useState<TrashedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    fetchTrash()
  }, [])

  async function fetchTrash() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/backend/trash', {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to fetch trash')
      const data = await res.json()
      setFiles(data.files || [])
    } catch (err) {
      console.error(err)
      setError('Failed to load trash. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRestore(file: TrashedFile) {
    setProcessingId(file.id)
    try {
      const res = await fetch(`/api/backend/trash/${file.id}/restore`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Restore failed')
      setFiles(files.filter(f => f.id !== file.id))
    } catch (err) {
      console.error(err)
      alert('Failed to restore file')
    } finally {
      setProcessingId(null)
    }
  }

  async function handlePermanentDelete(file: TrashedFile) {
    if (!confirm(`Are you sure you want to permanently delete ${file.name}? This cannot be undone.`)) return
    
    setProcessingId(file.id)
    try {
      const res = await fetch(`/api/backend/trash/${file.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Delete failed')
      setFiles(files.filter(f => f.id !== file.id))
    } catch (err) {
      console.error(err)
      alert('Failed to delete file')
    } finally {
      setProcessingId(null)
    }
  }

  async function handleEmptyTrash() {
    if (!confirm('Are you sure you want to empty the trash? All items will be permanently deleted.')) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/backend/trash/empty', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Empty trash failed')
      setFiles([])
    } catch (err) {
      console.error(err)
      alert('Failed to empty trash')
    } finally {
      setLoading(false)
    }
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Trash2 className="text-red-500" />
            Trash Bin
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Items in the trash can be restored or permanently deleted.
          </p>
        </div>
        
        {files.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Empty Trash
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex items-center gap-3 text-red-700 dark:text-red-400">
          <XCircle size={20} />
          {error}
        </div>
      )}

      {loading && files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500">Loading your trash...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <EmptyState
            data-testid="trash-empty-state"
            icon={<Trash2 size={40} className="text-gray-400" />}
            title="Trash is empty"
            description="Any files you delete will appear here."
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm font-medium">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Original Location</th>
                <th className="px-6 py-4 text-right">Size</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {files.map((file) => (
                <tr key={file.id} className="hover: dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                        {file.isFolder ? '📁' : '📄'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
                          {file.name}
                        </div>
                        <div className="text-xs text-gray-500 uppercase">{file.providerId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs font-mono">
                    {file.originalPath || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 text-right font-mono">
                    {formatSize(file.size)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleRestore(file)}
                        disabled={!!processingId}
                        className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors title='Restore'"
                        title="Restore"
                      >
                        <RotateCcw size={18} className={processingId === file.id ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(file)}
                        disabled={!!processingId}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Permanently Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 flex gap-3 text-sm text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
        <Info size={20} className="flex-shrink-0" />
        <p>
          Items in the trash will be automatically deleted after 30 days. You can restore them anytime before then.
        </p>
      </div>
    </div>
  )
}
