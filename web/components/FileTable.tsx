'use client'
import { retryFile, deleteFile, downloadFile } from '@/lib/api'

const STATUS_COLORS: Record<string, string> = {
  synced: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  syncing: 'bg-blue-100 text-blue-700',
  error: 'bg-red-100 text-red-700',
  deleted: 'bg-gray-100 text-gray-500',
}

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
    </div>
  )
}
