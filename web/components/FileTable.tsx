'use client'
import { useState } from 'react'
import { retryFile, deleteFile, downloadFile, renameFile, createShareLink } from '@/lib/api'
import StatusBadge from '@/components/StatusBadge'
import ShareDialog from '@/components/ShareDialog'

interface FileItem {
  id: string
  path: string
  name?: string  // Optional - for cloud providers that pass name separately
  size_bytes: string | number
  status: string
  error_reason?: string
  retry_count?: number
  created_at: string
  immutable_until?: string
}

interface FileTableProps {
  files: FileItem[]
  token: string
  onRefresh: () => void
  viewMode: 'list' | 'grid'
  currentPath?: string
  onMoveFile?: (fileId: string, newPath: string) => Promise<void>
}

// Remove UUID prefix if present (for backward compatibility during migration)
function cleanPath(path: string) {
  // Remove UUID prefix if it exists
  const withoutUUID = path.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//, '')
  // Return just the filename (last segment)
  return withoutUUID.split('/').pop() || withoutUUID
}

function formatBytes(b: string | number) {
  const n = typeof b === 'string' ? parseInt(b) : b
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB'
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

export default function FileTable({ files, token, onRefresh, viewMode, currentPath = '/', onMoveFile }: FileTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [shareDialog, setShareDialog] = useState<{ id: string; filename: string } | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [movePath, setMovePath] = useState('')
  const [moveLoading, setMoveLoading] = useState(false)

  async function handleDownload(id: string, filepath: string) {
    const filename = cleanPath(filepath)
    await downloadFile(id, filename, token).catch(e => alert('Download failed: ' + e.message))
  }

  async function handleRetry(id: string) {
    await retryFile(id, token).catch(e => alert('Retry failed: ' + e.message))
    onRefresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this file?')) return
    await deleteFile(id, token).catch(e => alert('Delete failed: ' + e.message))
    onRefresh()
  }

  function startRename(id: string, filepath: string) {
    setEditingId(id)
    setRenameValue(file.name || cleanPath(filepath))
    setRenameError(null)
  }

  function cancelRename() {
    setEditingId(null)
    setRenameValue('')
    setRenameError(null)
  }

  async function handleRename(id: string) {
    // Server contract: PATCH /files/:id expects { path: newName } where newName is just the filename
    // The server handles reconstructing the full path from the file's current parent directory
    setRenameLoading(true)
    setRenameError(null)
    try {
      await renameFile(id, renameValue, token)
      setEditingId(null)
      onRefresh()
    } catch (e: unknown) {
      setRenameError(e instanceof Error ? e.message : 'Rename failed')
    } finally {
      setRenameLoading(false)
    }
  }

  async function handleMove(id: string) {
    if (!onMoveFile) return

    setMoveLoading(true)
    try {
      await onMoveFile(id, movePath)
      setMovingId(null)
      setMovePath('')
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Move failed')
    } finally {
      setMoveLoading(false)
    }
  }

  function startMove(id: string, currentPath: string) {
    setMovingId(id)
    setMovePath(currentPath)
  }

  function cancelMove() {
    setMovingId(null)
    setMovePath('')
  }

  if (!files.length) return (
    <p className="text-gray-400 text-center py-8">No files yet. Upload a file to get started.</p>
  )

  const renderActions = (f: FileItem) => {
    if (movingId === f.id) return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <input
            type="text"
            value={movePath}
            onChange={e => setMovePath(e.target.value)}
            placeholder="New path"
            className="border rounded px-2 py-0.5 text-xs font-mono w-48 focus:outline-none focus:ring-1 focus:ring-blue-400"
            onKeyDown={e => {
              if (e.key === 'Enter') handleMove(f.id)
              if (e.key === 'Escape') cancelMove()
            }}
          />
          <button
            onClick={() => handleMove(f.id)}
            disabled={moveLoading}
            className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded disabled:opacity-50"
          >
            {moveLoading ? '...' : 'Move'}
          </button>
          <button
            onClick={cancelMove}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
          >
            X
          </button>
        </div>
        <span className="text-xs text-gray-500">
          Current: {f.name || cleanPath(f.path)}
        </span>
      </div>
    )

    return (
      <div className="flex flex-wrap gap-1">
        {f.status === 'synced' && (
          <button onClick={() => handleDownload(f.id, f.path)}
            className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded hover:bg-green-100">Download</button>
        )}
        {(f.status === 'synced' || f.status === 'pending') && (
          <button onClick={() => setShareDialog({ id: f.id, filename: f.name || cleanPath(f.path) })}
            className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded hover:bg-purple-100">Share</button>
        )}
        <button onClick={() => startRename(f.id, f.path)}
          className="text-xs bg-yellow-50 text-yellow-600 px-2 py-1 rounded hover:bg-yellow-100">Rename</button>
        {onMoveFile && (
          <button onClick={() => startMove(f.id, f.path)}
            className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100">Move</button>
        )}
        {f.status === 'error' && (
          <button onClick={() => handleRetry(f.id)}
            className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">Retry</button>
        )}
        {f.immutable_until && new Date(f.immutable_until) > new Date() ? (
          <span className="text-xs text-gray-400 flex items-center gap-1" title={`Locked until ${f.immutable_until}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Locked
          </span>
        ) : (
          <button onClick={() => handleDelete(f.id)}
            className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded hover:bg-red-100">Delete</button>
        )}
      </div>
    )
  }

  const renderName = (f: FileItem) => {
    if (editingId === f.id) return (
      <div className="flex flex-col gap-1">
        <div className="flex gap-1">
          <input type="text" value={renameValue} disabled={renameLoading}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(f.id); if (e.key === 'Escape') cancelRename() }}
            className="border rounded px-2 py-0.5 text-xs font-mono w-48 focus:outline-none focus:ring-1 focus:ring-blue-400" />
          <button onClick={() => handleRename(f.id)} disabled={renameLoading}
            className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded disabled:opacity-50">
            {renameLoading ? '...' : 'Save'}
          </button>
          <button onClick={cancelRename}
            className="text-xs text-gray-400 hover:text-gray-600 px-1">X</button>
        </div>
        {renameError && <span className="text-xs text-red-500">{renameError}</span>}
      </div>
    )
    return <span className="font-mono text-xs truncate max-w-xs">{f.name || cleanPath(f.path)}</span>
  }

  if (viewMode === 'grid') return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {files.map(f => (
          <div key={f.id} className="border rounded-lg p-3 bg-white hover:shadow-sm">
            <div className="mb-2">{renderName(f)}</div>
            <div className="flex items-center justify-between mb-2">
              <StatusBadge status={f.status} />
              <span className="text-xs text-gray-400">{formatBytes(f.size_bytes)}</span>
            </div>
            {f.error_reason && <p className="text-xs text-red-400 mb-2 truncate">{f.error_reason}</p>}
            {renderActions(f)}
          </div>
        ))}
      </div>
      {shareDialog && (
        <ShareDialog fileId={shareDialog.id} filename={shareDialog.filename} token={token}
          onClose={() => setShareDialog(null)} onShareCreated={() => setShareDialog(null)} />
      )}
    </>
  )

  return (
    <>
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
                <td className="py-2 pr-4">{renderName(f)}</td>
                <td className="py-2 pr-4 text-gray-500 text-xs">{formatBytes(f.size_bytes)}</td>
                <td className="py-2 pr-4">
                  <StatusBadge status={f.status} />
                  {f.error_reason && <p className="text-xs text-red-400 mt-0.5">{f.error_reason}</p>}
                </td>
                <td className="py-2">{renderActions(f)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shareDialog && (
        <ShareDialog fileId={shareDialog.id} filename={shareDialog.filename} token={token}
          onClose={() => setShareDialog(null)} onShareCreated={() => setShareDialog(null)} />
      )}
    </>
  )
}
