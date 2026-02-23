'use client'
import { retryFile, deleteFile, downloadFile, createShareLink } from '@/lib/api'

const STATUS_COLORS: Record<string, string> = {
  synced: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  syncing: 'bg-blue-100 text-blue-700',
  error: 'bg-red-100 text-red-700',
  deleted: 'bg-gray-100 text-gray-500',
}

import { useState } from 'react'
export default function FileTable({ files, token, onRefresh }: { files: any[], token: string, onRefresh: () => void }) {
  async function handleDownload(id: string, filepath: string) {
    const filename = filepath.split('/').pop() || 'download'
    await downloadFile(id, filename, token).catch(e => alert('Download failed: ' + e.message))
  }
  async function handleRetry(id: string) {
    await retryFile(id, token)
    onRefresh()
  }
  async function handleDelete(id: string) {
    if (!confirm('Delete this file?')) return
    await deleteFile(id, token)
    onRefresh()
  }
  const [shareResult, setShareResult] = useState<{id: string, url: string} | null>(null)
  const [shareLoading, setShareLoading] = useState<string | null>(null)

  async function handleShare(id: string) {
    setShareLoading(id)
    try {
      const data = await createShareLink(id, token)
      const url = `${window.location.origin}/share/${data.share_link?.token || data.token}`
      setShareResult({ id, url })
    } catch (e: unknown) {
      alert('Share failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setShareLoading(null)
    }
  }

  if (!files.length) return <p className="text-gray-400 text-center py-8">No files yet. Upload a file to get started.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="pb-2 pr-4">Name</th>
            <th className="pb-2 pr-4">Size</th>
            <th className="pb-2 pr-4">Status</th>
            <th className="pb-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map(f => (
            <tr key={f.id} className="border-b hover:bg-gray-50">
              <td className="py-2 pr-4 font-mono text-xs truncate max-w-xs">{f.path.split('/').pop()}</td>
              <td className="py-2 pr-4 text-gray-500">{(f.size_bytes / 1024).toFixed(1)} KB</td>
              <td className="py-2 pr-4">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[f.status] || ''}`}>
                  {f.status}
                </span>
                {f.error_reason && <p className="text-xs text-red-400 mt-0.5 truncate max-w-xs">{f.error_reason}</p>}
              </td>
              <td className="py-2 flex gap-2">
                {f.status === 'synced' && (
                  <button onClick={() => handleDownload(f.id, f.path)}
                    className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded hover:bg-green-100">Download</button>
                )}
                {(f.status === 'synced' || f.status === 'pending') && (
                  <button onClick={() => handleShare(f.id)} disabled={shareLoading === f.id}
                    className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded hover:bg-purple-100 disabled:opacity-50">
                    {shareLoading === f.id ? '...' : 'Share'}
                  </button>
                )}
                {f.status === 'error' && (
                  <button onClick={() => handleRetry(f.id)}
                    className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">Retry</button>
                )}
                <button onClick={() => handleDelete(f.id)}
                  className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded hover:bg-red-100">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    {shareResult && (
      <div className="mt-4 p-3 bg-purple-50 rounded-lg flex items-center gap-3 text-sm">
        <span className="text-purple-700 font-medium">Share link:</span>
        <span className="flex-1 text-purple-600 truncate font-mono text-xs">{shareResult.url}</span>
        <button onClick={() => { navigator.clipboard.writeText(shareResult.url); }}
          className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700">Copy</button>
        <button onClick={() => setShareResult(null)}
          className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
      </div>
    )}
    </div>
  )
}
