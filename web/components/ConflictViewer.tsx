'use client'

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

interface ConflictViewerProps {
  conflict: Conflict
  onResolve: (resolution: 'keep_local' | 'keep_cloud' | 'keep_both') => void
  resolving?: string | null
}

export default function ConflictViewer({ conflict, onResolve, resolving }: ConflictViewerProps) {
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

  const handleButtonClick = (resolution: 'keep_local' | 'keep_cloud' | 'keep_both') => {
    alert('Coming soon')
  }

  return (
    <div>
      {conflict.status === 'resolved' && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span className="text-green-700 font-medium">This conflict has been resolved.</span>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">{conflict.filename}</h2>
        <p className="text-gray-600 text-sm">
          Conflict detected: {formatDate(conflict.detected_at)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Local Version */}
        <div className="border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Your Version</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Local</span>
          </div>

          {conflict.local_version ? (
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Path</div>
                <div className="font-mono text-xs truncate">{conflict.local_version.path}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Size</div>
                <div className="font-medium">{formatFileSize(conflict.local_version.size_bytes)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Last Modified</div>
                <div className="font-medium">{formatDate(conflict.local_version.modified_at)}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No local version available
            </div>
          )}
        </div>

        {/* Cloud Version */}
        <div className="border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Cloud Version</h3>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Cloud</span>
          </div>

          {conflict.cloud_version ? (
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-500">Path</div>
                <div className="font-mono text-xs truncate">{conflict.cloud_version.path}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Size</div>
                <div className="font-medium">{formatFileSize(conflict.cloud_version.size_bytes)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Last Modified</div>
                <div className="font-medium">{formatDate(conflict.cloud_version.modified_at)}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No cloud version available
            </div>
          )}
        </div>
      </div>

      {conflict.status === 'unresolved' && (
        <div className="border-t pt-6">
          <h3 className="font-semibold text-gray-800 mb-4">Choose how to resolve this conflict:</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleButtonClick('keep_local')}
              disabled={!!resolving}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 disabled:opacity-50"
            >
              Keep Mine
            </button>
            <button
              onClick={() => handleButtonClick('keep_cloud')}
              disabled={!!resolving}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50 disabled:opacity-50"
            >
              Keep Cloud
            </button>
            <button
              onClick={() => handleButtonClick('keep_both')}
              disabled={!!resolving}
              className="px-4 py-2 border border-green-600 text-green-600 rounded hover:bg-green-50 disabled:opacity-50"
            >
              Keep Both
            </button>
          </div>
          <p className="text-gray-500 text-sm mt-3">
            <strong>Keep Mine:</strong> Use your local version and discard cloud changes<br />
            <strong>Keep Cloud:</strong> Use cloud version and discard your local changes<br />
            <strong>Keep Both:</strong> Keep both versions (renames cloud version)
          </p>
        </div>
      )}
    </div>
  )
}