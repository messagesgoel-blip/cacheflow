'use client'
import { retryFile, deleteFile, downloadFile, createShareLink, renameFile } from '@/lib/api'
import ShareDialog from './ShareDialog'

const STATUS_COLORS: Record<string, string> = {
  synced: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  syncing: 'bg-blue-100 text-blue-700',
  error: 'bg-red-100 text-red-700',
  deleted: 'bg-gray-100 text-gray-500',
}

import { useState } from 'react'
export default function FileTable({ files, token, onRefresh, viewMode = 'list' }: { files: any[], token: string, onRefresh: () => void, viewMode?: 'list' | 'grid' }) {
  // Helper function to strip user_id UUID prefix from path for display
  function stripUserIdPrefix(path: string): string {
    // Strip anything matching /^[0-9a-f-]{36}\// from the start of path
    return path.replace(/^[0-9a-f-]{36}\//, '')
  }
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
  const [shareDialog, setShareDialog] = useState<{id: string, filename: string} | null>(null)
  const [shareResult, setShareResult] = useState<{id: string, url: string} | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState<string>('')
  const [renameLoading, setRenameLoading] = useState<string | null>(null)
  const [renameError, setRenameError] = useState<string | null>(null)

  function handleShareClick(id: string, filename: string) {
    setShareDialog({ id, filename })
  }

  function handleShareCreated(url: string) {
    setShareResult({ id: shareDialog!.id, url })
    setShareDialog(null)
  }

  function handleShareDialogClose() {
    setShareDialog(null)
  }

  async function handleRename(id: string, currentPath: string) {
    if (!renameValue.trim() || renameValue === currentPath.split('/').pop()) {
      setEditingId(null)
      setRenameError(null)
      return
    }

    setRenameLoading(id)
    setRenameError(null)
    try {
      await renameFile(id, renameValue.trim(), token)
      setEditingId(null)
      setRenameValue('')
      onRefresh()
    } catch (e: unknown) {
      setRenameError(e instanceof Error ? e.message : String(e))
    } finally {
      setRenameLoading(null)
    }
  }

  function startRename(id: string, currentPath: string) {
    setEditingId(id)
    setRenameValue(stripUserIdPrefix(currentPath).split('/').pop() || '')
    setRenameError(null)
  }

  function cancelRename() {
    setEditingId(null)
    setRenameValue('')
    setRenameError(null)
  }

  if (!files.length) return <p className="text-gray-400 text-center py-8">No files yet. Upload a file to get started.</p>

  const renderGridView = () => (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map(f => (
            <div key={f.id} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="font-mono text-xs truncate mb-2">{stripUserIdPrefix(f.path).split('/').pop()}</div>
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[f.status] || ''}`}>
                  {f.status}
                </span>
                <span className="text-xs text-gray-500">{(f.size_bytes / 1024).toFixed(1)} KB</span>
              </div>
              {f.error_reason && <p className="text-xs text-red-400 mb-2 truncate">{f.error_reason}</p>}
              <div className="flex flex-wrap gap-1">
                {f.status === 'synced' && (
                  <button onClick={() => handleDownload(f.id, f.path)}
                    className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded hover:bg-green-100">Download</button>
                )}
                {(f.status === 'synced' || f.status === 'pending') && (
                  <button onClick={() => handleShareClick(f.id, stripUserIdPrefix(f.path).split('/').pop() || '')}
                    className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded hover:bg-purple-100">
                    Share
                  </button>
                )}
                {f.status === 'error' && (
                  <button onClick={() => handleRetry(f.id)}
                    className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">Retry</button>
                )}
                {f.status !== 'deleted' && (
                  <button onClick={() => startRename(f.id, f.path)}
                    className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded hover:bg-gray-100">Rename</button>
                )}
                <button onClick={() => handleDelete(f.id)}
                  className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded hover:bg-red-100">Delete</button>
              </div>
              {editingId === f.id && (
                <div className="mt-3 p-2 border rounded bg-gray-50">
                  <div className="flex gap-1 mb-1">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(f.id, f.path)
                        if (e.key === 'Escape') cancelRename()
                      }}
                      disabled={renameLoading === f.id}
                      className="flex-1 px-2 py-1 text-xs border rounded bg-white disabled:bg-gray-50"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRename(f.id, f.path)}
                      disabled={renameLoading === f.id}
                      className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded hover:bg-green-100 disabled:opacity-50"
                    >
                      {renameLoading === f.id ? '...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelRename}
                      disabled={renameLoading === f.id}
                      className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {renameError && editingId === f.id && (
                    <p className="text-xs text-red-500">{renameError}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
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

  const renderListView = () => (
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
              <td className="py-2 pr-4 font-mono text-xs truncate max-w-xs">
                {editingId === f.id ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(f.id, f.path)
                          if (e.key === 'Escape') cancelRename()
                        }}
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
              <td className="py-2 pr-4 font-mono text-xs truncate max-w-xs">
                {editingId === f.id ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(f.id, f.path)
                          if (e.key === 'Escape') cancelRename()
                        }}
                        disabled={renameLoading === f.id}
                        className="flex-1 px-2 py-1 text-xs border rounded bg-white disabled:bg-gray-50"
                        autoFocus
                      />
                      <button
                        onClick={() => handleRename(f.id, f.path)}
                        disabled={renameLoading === f.id}
                        className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded hover:bg-green-100 disabled:opacity-50"
                      >
                        {renameLoading === f.id ? '...' : 'Save'}
                      </button>
                      <button
                        onClick={cancelRename}
                        disabled={renameLoading === f.id}
                        className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                    {renameError && editingId === f.id && (
                      <p className="text-xs text-red-500">{renameError}</p>
                    )}
                  </div>
                ) : (
                  stripUserIdPrefix(f.path).split('/').pop()
                )}
              </td>
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
                  <button onClick={() => handleShareClick(f.id, stripUserIdPrefix(f.path).split('/').pop() || '')}
                    className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded hover:bg-purple-100">
                    Share
                  </button>
                )}
                {f.status === 'error' && (
                  <button onClick={() => handleRetry(f.id)}
                    className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">Retry</button>
                )}
                {f.status !== 'deleted' && (
                  <button onClick={() => startRename(f.id, f.path)}
                    className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded hover:bg-gray-100">Rename</button>
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

  return (
    <>
      {viewMode === 'grid' ? renderGridView() : renderListView()}
      {shareDialog && (
        <ShareDialog
          fileId={shareDialog.id}
          filename={shareDialog.filename}
          token={token}
          onClose={handleShareDialogClose}
          onShareCreated={handleShareCreated}
        />
      )}
    </>
  )
}
