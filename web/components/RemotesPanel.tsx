'use client'

import { useState, useEffect } from 'react'
import { getRemotes, addRemote, deleteRemote, browseRemote, copyFromRemote } from '@/lib/api'

interface Remote {
  id: string
  name: string
  type: string
  provider: string
  status?: string
  used?: number
  total?: number
  free?: number
  error?: string
}

interface RemoteBrowseResult {
  path: string
  folders: Array<{ name: string; path: string; isFolder: boolean }>
  files: Array<{ name: string; path: string; isFolder: boolean; size_bytes: number; last_modified: string }>
  totalItems: number
  remoteName: string
  remoteType: string
}

interface RemotesPanelProps {
  token: string
}

// Common remote types
const REMOTE_TYPES = [
  { value: 'drive', label: 'Google Drive', provider: 'google' },
  { value: 'onedrive', label: 'Microsoft OneDrive', provider: 'onedrive' },
  { value: 's3', label: 'Amazon S3', provider: 'aws' },
  { value: 'b2', label: 'Backblaze B2', provider: 'b2' },
  { value: 'dropbox', label: 'Dropbox', provider: 'dropbox' },
  { value: 'pcloud', label: 'pCloud', provider: 'pcloud' },
  { value: 'box', label: 'Box', provider: 'box' },
  { value: 'mega', label: 'Mega', provider: 'mega' },
  { value: 'webdav', label: 'WebDAV', provider: 'webdav' },
]

export default function RemotesPanel({ token }: RemotesPanelProps) {
  const [remotes, setRemotes] = useState<Remote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [browsingRemote, setBrowsingRemote] = useState<RemoteBrowseResult | null>(null)
  const [currentPath, setCurrentPath] = useState('/')
  const [selectedRemote, setSelectedRemote] = useState<string | null>(null)
  const [copying, setCopying] = useState<string | null>(null)

  // Form state
  const [newRemoteName, setNewRemoteName] = useState('')
  const [newRemoteType, setNewRemoteType] = useState('drive')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [refreshToken, setRefreshToken] = useState('')
  const [tokenExpiry, setTokenExpiry] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadRemotes()
  }, [token])

  async function loadRemotes() {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      const data = await getRemotes(token)
      setRemotes(data.remotes || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load remotes')
      console.error('Failed to load remotes:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleBrowse(remoteName: string, path: string = '/') {
    try {
      setLoading(true)
      const data = await browseRemote(remoteName, path, token)
      setBrowsingRemote(data)
      setCurrentPath(path)
      setSelectedRemote(remoteName)
    } catch (err: any) {
      setError(err.message || 'Failed to browse remote')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy(remoteName: string, filePath: string) {
    if (!confirm(`Copy "${filePath}" to local storage?`)) return

    try {
      setCopying(filePath)
      await copyFromRemote(remoteName, filePath, '', token)
      alert('File copied to local storage!')
    } catch (err: any) {
      alert(`Copy failed: ${err.message}`)
    } finally {
      setCopying(null)
    }
  }

  async function handleAddRemote() {
    if (!newRemoteName.trim()) {
      alert('Please enter a name for this remote')
      return
    }

    setAdding(true)
    setError(null)

    try {
      const config: Record<string, string> = {}

      if (newRemoteType === 'drive') {
        config.client_id = clientId
        config.client_secret = clientSecret
        config.access_token = accessToken
        config.refresh_token = refreshToken
        config.token_expiry = tokenExpiry
      } else if (newRemoteType === 'onedrive') {
        config.client_id = clientId
        config.client_secret = clientSecret
        config.access_token = accessToken
      } else if (newRemoteType === 's3') {
        config.provider = 'AWS'
        config.access_key_id = clientId
        config.secret_access_key = clientSecret
      } else if (newRemoteType === 'webdav') {
        config.url = clientId
        config.vendor = 'other'
        config.user = accessToken
        config.pass = refreshToken
      }

      await addRemote(newRemoteName, newRemoteType, newRemoteType, config, token)
      setShowAddModal(false)
      resetForm()
      loadRemotes()
    } catch (err: any) {
      setError(err.message || 'Failed to add remote')
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteRemote(name: string) {
    if (!confirm(`Delete remote "${name}"?`)) return

    try {
      await deleteRemote(name, token)
      loadRemotes()
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`)
    }
  }

  function resetForm() {
    setNewRemoteName('')
    setNewRemoteType('drive')
    setClientId('')
    setClientSecret('')
    setAccessToken('')
    setRefreshToken('')
    setTokenExpiry('')
  }

  function formatBytes(bytes: number): string {
    if (!bytes) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  }

  function getTypeIcon(type: string): string {
    switch (type) {
      case 'drive': return '📁'
      case 'onedrive': return '☁️'
      case 's3': return '🪣'
      case 'dropbox': return '📦'
      case 'b2': return '💾'
      case 'webdav': return '🌐'
      default: return '💾'
    }
  }

  // If browsing a remote, show file browser
  if (browsingRemote) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setBrowsingRemote(null)}
              className="text-blue-600 hover:text-blue-800"
            >
              ← Back to Remotes
            </button>
            <span className="text-lg font-medium">
              {getTypeIcon(browsingRemote.remoteType)} {selectedRemote} {browsingRemote.path}
            </span>
          </div>
          <button
            onClick={() => handleBrowse(selectedRemote!, currentPath)}
            className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
          >
            Refresh
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <button onClick={() => handleBrowse(selectedRemote!, '/')} className="hover:text-blue-600">/</button>
          {currentPath.split('/').filter(Boolean).map((segment, i, arr) => (
            <span key={i} className="flex items-center">
              <span className="mx-1">/</span>
              <button
                onClick={() => handleBrowse(selectedRemote!, '/' + arr.slice(0, i + 1).join('/'))}
                className="hover:text-blue-600"
              >
                {segment}
              </button>
            </span>
          ))}
        </div>

        {/* Folders */}
        {browsingRemote.folders.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {browsingRemote.folders.map(folder => (
              <button
                key={folder.path}
                onClick={() => handleBrowse(selectedRemote!, folder.path)}
                className="p-3 border rounded-lg text-left hover:bg-gray-50"
              >
                <div className="text-lg mb-1">📁</div>
                <div className="text-sm font-medium truncate">{folder.name}</div>
              </button>
            ))}
          </div>
        )}

        {/* Files */}
        {browsingRemote.files.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Name</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Size</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Modified</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {browsingRemote.files.map(file => (
                  <tr key={file.path} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span>📄</span>
                        <span className="truncate">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-600">
                      {formatBytes(file.size_bytes)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-600">
                      {file.last_modified ? new Date(file.last_modified).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleCopy(selectedRemote!, file.path)}
                        disabled={copying === file.path}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {copying === file.path ? 'Copying...' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {browsingRemote.totalItems === 0 && (
          <div className="text-center py-8 text-gray-400">
            This folder is empty
          </div>
        )}
      </div>
    )
  }

  // Main remotes list
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Cloud Drives</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Cloud Drive
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200 text-sm">
          {error}
        </div>
      )}

      {loading && remotes.length === 0 ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : remotes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <div className="text-4xl mb-4">☁️</div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">No Cloud Drives Connected</h3>
          <p className="text-gray-500 mb-4">Connect Google Drive, OneDrive, S3, and more</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Your First Cloud Drive
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {remotes.map(remote => (
            <div key={remote.id} className="border rounded-lg p-4 hover:shadow-md">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getTypeIcon(remote.type)}</span>
                  <div>
                    <div className="font-medium">{remote.name}</div>
                    <div className="text-sm text-gray-500">{remote.provider}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  remote.status === 'connected' ? 'bg-green-100 text-green-800' :
                  remote.status === 'error' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {remote.status || 'unknown'}
                </span>
              </div>

              {remote.total > 0 && (
                <div className="mb-3">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min(100, (remote.used / remote.total) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{formatBytes(remote.used)} used</span>
                    <span>{formatBytes(remote.total)} total</span>
                  </div>
                </div>
              )}

              {remote.error && (
                <div className="mb-3 text-xs text-red-600">{remote.error}</div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleBrowse(remote.name, '/')}
                  className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Browse
                </button>
                <button
                  onClick={() => handleDeleteRemote(remote.name)}
                  className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Remote Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Add Cloud Drive</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Connection Name
                </label>
                <input
                  type="text"
                  value={newRemoteName}
                  onChange={(e) => setNewRemoteName(e.target.value)}
                  placeholder="e.g., My Google Drive"
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cloud Provider
                </label>
                <select
                  value={newRemoteType}
                  onChange={(e) => setNewRemoteType(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  {REMOTE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {newRemoteType === 'drive' && (
                <>
                  <div className="p-3 bg-blue-50 rounded text-sm">
                    <p className="font-medium mb-2">How to get credentials:</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-600">
                      <li>Go to <a href="https://console.cloud.google.com/" target="_blank" className="text-blue-600 underline">Google Cloud Console</a></li>
                      <li>Create a project and enable Drive API</li>
                      <li>Create OAuth credentials (Desktop app)</li>
                      <li>Copy Client ID and Client Secret below</li>
                    </ol>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client ID
                    </label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="Your Google OAuth Client ID"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Client Secret
                    </label>
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="Your Google OAuth Client Secret"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Access Token (from rclone)
                    </label>
                    <textarea
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder='{"token": "..."}'
                      className="w-full border rounded px-3 py-2 text-sm"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Refresh Token (from rclone)
                    </label>
                    <input
                      type="password"
                      value={refreshToken}
                      onChange={(e) => setRefreshToken(e.target.value)}
                      placeholder="Refresh token"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Token Expiry
                    </label>
                    <input
                      type="text"
                      value={tokenExpiry}
                      onChange={(e) => setTokenExpiry(e.target.value)}
                      placeholder="2026-02-25T12:00:00.000000000Z"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div className="p-3 bg-yellow-50 rounded text-sm">
                    <p className="font-medium">Tip:</p>
                    <p className="text-gray-600">
                      Run <code className="bg-gray-100 px-1 rounded">rclone config create mydrive drive</code> locally to get tokens, then copy them here.
                    </p>
                  </div>
                </>
              )}

              {newRemoteType === 's3' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Access Key ID
                    </label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Secret Access Key
                    </label>
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="Your S3 Secret Key"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </>
              )}

              {newRemoteType === 'webdav' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      WebDAV URL
                    </label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="https://webdav.example.com/remote.php/dav/"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="Username"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={refreshToken}
                      onChange={(e) => setRefreshToken(e.target.value)}
                      placeholder="Password"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); resetForm() }}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRemote}
                disabled={adding || !newRemoteName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add Drive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
