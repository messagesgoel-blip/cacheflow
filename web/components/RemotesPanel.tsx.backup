'use client'

import { useState, useEffect } from 'react'
import { getRemotes, addRemote, deleteRemote, browseRemote, copyFromRemote, setRemoteToken, connectGoogleDrive } from '@/lib/api'

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

// Cloud provider options with setup instructions
const CLOUD_PROVIDERS = [
  {
    id: 'drive',
    name: 'Google Drive',
    icon: '📧',
    description: 'Connect to your Google Drive account',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: '.apps.googleusercontent.com', type: 'text' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'Your client secret', type: 'password' },
    ],
    help: 'Get credentials from Google Cloud Console > APIs & Services > Credentials > OAuth Client ID',
    setupInstructions: [
      { step: 1, text: 'Go to https://console.cloud.google.com and create a new project (or select existing)' },
      { step: 2, text: 'Navigate to APIs & Services > Library and enable the "Google Drive API"' },
      { step: 3, text: 'Go to APIs & Services > OAuth consent screen' },
      { step: 4, text: 'Select "External" user type and click Create' },
      { step: 5, text: 'Fill in required fields: App name, User support email, Developer contact email' },
      { step: 6, text: 'AddScopes: add ".../auth/drive.readonly" and ".../auth/drive.metadata.readonly"' },
      { step: 7, text: 'AddTestUsers: add your Google email address (required for testing)' },
      { step: 8, text: 'Click Save and Continue through remaining screens' },
      { step: 9, text: 'Go to APIs & Services > Credentials > Create Credentials > OAuth Client ID' },
      { step: 10, text: 'Application type: Web application' },
      { step: 11, text: 'Add Authorized JavaScript origins: https://cacheflow.goels.in (your CacheFlow URL)' },
      { step: 12, text: 'Add Authorized redirect URIs: https://cacheflow.goels.in (or your URL)' },
      { step: 13, text: 'Click Create to get your Client ID and Client Secret' },
    ]
  },
  {
    id: 'webdav',
    name: 'WebDAV',
    icon: '🌐',
    description: 'Connect to any WebDAV server (Nextcloud, ownCloud, etc.)',
    fields: [
      { key: 'url', label: 'WebDAV URL', placeholder: 'https://your-server.com/remote.php/dav/files/username/', type: 'text' },
      { key: 'user', label: 'Username', placeholder: 'Your username', type: 'text' },
      { key: 'pass', label: 'Password', placeholder: 'Your password', type: 'password' },
    ]
  },
  {
    id: 's3',
    name: 'Amazon S3',
    icon: '🪣',
    description: 'Connect to Amazon S3 or S3-compatible storage',
    fields: [
      { key: 'access_key', label: 'Access Key ID', placeholder: 'AKIAIOSFODNN7EXAMPLE', type: 'text' },
      { key: 'secret_key', label: 'Secret Access Key', placeholder: 'Your secret key', type: 'password' },
      { key: 'endpoint', label: 'Endpoint (optional)', placeholder: 's3.amazonaws.com', type: 'text' },
      { key: 'bucket', label: 'Bucket Name', placeholder: 'my-bucket', type: 'text' },
    ]
  },
  {
    id: 'b2',
    name: 'Backblaze B2',
    icon: '💾',
    description: 'Connect to Backblaze B2 cloud storage',
    fields: [
      { key: 'application_key_id', label: 'Application Key ID', placeholder: 'Your key ID', type: 'text' },
      { key: 'application_key', label: 'Application Key', placeholder: 'Your application key', type: 'password' },
    ]
  },
  {
    id: 'ftp',
    name: 'FTP/SFTP',
    icon: '📂',
    description: 'Connect to FTP or SFTP server',
    fields: [
      { key: 'host', label: 'Host', placeholder: 'ftp.example.com', type: 'text' },
      { key: 'port', label: 'Port', placeholder: '21 (FTP) or 22 (SFTP)', type: 'text' },
      { key: 'user', label: 'Username', placeholder: 'Your username', type: 'text' },
      { key: 'pass', label: 'Password', placeholder: 'Your password', type: 'password' },
    ]
  },
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
  const [showOauthModal, setShowOauthModal] = useState(false)
  const [oauthRemoteName, setOauthRemoteName] = useState('')
  const [oauthAuthorizeCmd, setOauthAuthorizeCmd] = useState('')
  const [oauthToken, setOauthToken] = useState('')
  const [oauthCredentials, setOauthCredentials] = useState('')
  const [oauthLoading, setOauthLoading] = useState(false)

  // Form state
  const [newRemoteName, setNewRemoteName] = useState('')
  const [newRemoteType, setNewRemoteType] = useState('webdav')
  const [formFields, setFormFields] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadRemotes()
  }, [token])

  function loadRemotes() {
    if (!token) return
    setLoading(true)
    setError(null)
    getRemotes(token)
      .then(data => setRemotes(data.remotes || []))
      .catch(err => {
        setError(err.message || 'Failed to load remotes')
        console.error('Failed to load remotes:', err)
      })
      .finally(() => setLoading(false))
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
      alert('Please enter a name for this connection')
      return
    }

    const provider = CLOUD_PROVIDERS.find(p => p.id === newRemoteType)
    if (!provider) {
      alert('Please select a provider')
      return
    }

    // Validate required fields (skip for Google Drive which has no fields)
    const requiredFields = provider.fields.filter(f => f.key !== 'endpoint' && f.key !== 'port')
    const missing = requiredFields.find(f => !formFields[f.key]?.trim())
    if (missing) {
      alert(`Please fill in: ${missing.label}`)
      return
    }

    setAdding(true)
    setError(null)

    try {
      // Build config based on provider type
      let config: Record<string, string> = {}
      let type = newRemoteType

      if (newRemoteType === 'drive') {
        config = {
          client_id: formFields.client_id || '',
          client_secret: formFields.client_secret || '',
        }
      } else if (newRemoteType === 'webdav') {
        config = {
          url: formFields.url || '',
          vendor: 'other',
          user: formFields.user || '',
          pass: formFields.pass || '',
        }
      } else if (newRemoteType === 's3') {
        config = {
          provider: 'AWS',
          access_key_id: formFields.access_key || '',
          secret_access_key: formFields.secret_key || '',
          endpoint: formFields.endpoint || 's3.amazonaws.com',
          bucket: formFields.bucket || '',
        }
      } else if (newRemoteType === 'b2') {
        config = {
          application_key_id: formFields.application_key_id || '',
          application_key: formFields.application_key || '',
        }
      } else if (newRemoteType === 'ftp') {
        config = {
          host: formFields.host || '',
          port: formFields.port || '21',
          user: formFields.user || '',
          pass: formFields.pass || '',
        }
        type = formFields.port === '22' ? 'sftp' : 'ftp'
      }

      // For Google Drive, use the new simpler OAuth flow
      if (newRemoteType === 'drive') {
        try {
          const driveResponse = await connectGoogleDrive(
            newRemoteName,
            { client_id: formFields.client_id, client_secret: formFields.client_secret },
            token
          )

          if (driveResponse.needsAuth && driveResponse.authUrl) {
            // Redirect to Google OAuth
            window.location.href = driveResponse.authUrl
            return
          }
        } catch (err: any) {
          setError(err.message || 'Failed to connect Google Drive')
          setAdding(false)
          return
        }
      }

      const response = await addRemote(newRemoteName, type, provider.name, config, token)

      setShowAddModal(false)
      resetForm()
      loadRemotes()
    } catch (err: any) {
      setError(err.message || 'Failed to add connection')
    } finally {
      setAdding(false)
    }
  }

  async function handleSubmitOauthToken() {
    if (!oauthToken.trim()) {
      alert('Please paste the token')
      return
    }

    setOauthLoading(true)
    setError(null)

    try {
      await setRemoteToken(oauthRemoteName, oauthToken, token, oauthCredentials)
      setShowOauthModal(false)
      setOauthToken('')
      setOauthCredentials('')
      loadRemotes()
    } catch (err: any) {
      setError(err.message || 'Failed to save token')
    } finally {
      setOauthLoading(false)
    }
  }

  async function handleDeleteRemote(name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      await deleteRemote(name, token)
      loadRemotes()
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`)
    }
  }

  function resetForm() {
    setNewRemoteName('')
    setNewRemoteType('webdav')
    setFormFields({})
  }

  function formatBytes(bytes: number): string {
    if (!bytes) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB'
    return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  }

  function getTypeIcon(type: string): string {
    const provider = CLOUD_PROVIDERS.find(p => p.id === type || p.id === 'webdav')
    return provider?.icon || '☁️'
  }

  // If browsing a remote, show file browser
  if (browsingRemote) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setBrowsingRemote(null)}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              ← Back to Drives
            </button>
            <span className="text-lg font-medium">
              {getTypeIcon(browsingRemote.remoteType)} {selectedRemote} {browsingRemote.path}
            </span>
          </div>
          <button
            onClick={() => handleBrowse(selectedRemote!, currentPath)}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200"
          >
            Refresh
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          <button onClick={() => handleBrowse(selectedRemote!, '/')} className="hover:text-blue-600 dark:hover:text-blue-400">/</button>
          {currentPath.split('/').filter(Boolean).map((segment, i, arr) => (
            <span key={i} className="flex items-center">
              <span className="mx-1">/</span>
              <button
                onClick={() => handleBrowse(selectedRemote!, '/' + arr.slice(0, i + 1).join('/'))}
                className="hover:text-blue-600 dark:hover:text-blue-400"
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
                className="p-3 border rounded-lg text-left hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                <div className="text-lg mb-1">📁</div>
                <div className="text-sm font-medium truncate dark:text-white">{folder.name}</div>
              </button>
            ))}
          </div>
        )}

        {/* Files */}
        {browsingRemote.files.length > 0 && (
          <div className="border rounded-lg overflow-hidden dark:border-gray-600">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">Name</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-600 dark:text-gray-300">Size</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-600 dark:text-gray-300">Modified</th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {browsingRemote.files.map(file => (
                  <tr key={file.path} className="border-t dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span>📄</span>
                        <span className="truncate dark:text-white">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-400">
                      {formatBytes(file.size_bytes)}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-400">
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
        <h2 className="text-xl font-semibold dark:text-white">Integrations</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Integration
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded border border-red-200 dark:border-red-800 text-sm">
          {error}
        </div>
      )}

      {loading && remotes.length === 0 ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : remotes.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg dark:border-gray-700">
          <div className="text-4xl mb-4">☁️</div>
          <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">No Integrations Connected</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Connect WebDAV, S3, B2, FTP servers and more</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Your First Integration
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {remotes.map(remote => (
            <div key={remote.id} className="border rounded-lg p-4 hover:shadow-md dark:border-gray-600 dark:bg-gray-800">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getTypeIcon(remote.type)}</span>
                  <div>
                    <div className="font-medium dark:text-white">{remote.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{remote.provider}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  remote.status === 'connected' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                  remote.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                  remote.status === 'pending_oauth' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {remote.status === 'pending_oauth' ? 'Needs Authorization' : (remote.status || 'unknown')}
                </span>
              </div>

              {remote.total && remote.total > 0 && (
                <div className="mb-3">
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min(100, ((remote.used || 0) / remote.total) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{formatBytes(remote.used || 0)} used</span>
                    <span>{formatBytes(remote.total || 0)} total</span>
                  </div>
                </div>
              )}

              {remote.error && (
                <div className="mb-3 text-xs text-red-600 dark:text-red-400">{remote.error}</div>
              )}

              <div className="flex gap-2">
                {remote.status === 'pending_oauth' ? (
                  <>
                    <button
                      onClick={() => {
                        // For now, show info - user needs to delete and re-add
                        alert('Please remove this integration and add it again to authorize.')
                      }}
                      className="flex-1 px-3 py-1.5 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Authorize
                    </button>
                    <button
                      onClick={() => handleDeleteRemote(remote.name)}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleBrowse(remote.name, '/')}
                      className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Browse
                    </button>
                    <button
                      onClick={() => handleDeleteRemote(remote.name)}
                      className="px-3 py-1.5 text-sm text-red-600 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Remote Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Add Integration</h3>

            <div className="space-y-4">
              {/* Connection Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Connection Name
                </label>
                <input
                  type="text"
                  value={newRemoteName}
                  onChange={(e) => setNewRemoteName(e.target.value)}
                  placeholder="e.g., My NAS, Work Server"
                  className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2"
                />
              </div>

              {/* Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Integration Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {CLOUD_PROVIDERS.map(provider => (
                    <button
                      key={provider.id}
                      onClick={() => { setNewRemoteType(provider.id); setFormFields({}) }}
                      className={`p-3 border rounded-lg text-left transition-all ${
                        newRemoteType === provider.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{provider.icon}</div>
                      <div className="font-medium dark:text-white">{provider.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{provider.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Fields */}
              {CLOUD_PROVIDERS.find(p => p.id === newRemoteType)?.fields.map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    value={formFields[field.key] || ''}
                    onChange={(e) => setFormFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2"
                  />
                </div>
              ))}

              {/* Help Text - Show detailed instructions for selected provider */}
              {(() => {
                const provider = CLOUD_PROVIDERS.find(p => p.id === newRemoteType);
                if (!provider?.setupInstructions) {
                  return (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded text-sm">
                      <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">
                        How to get credentials:
                      </p>
                      <ul className="text-blue-700 dark:text-blue-400 text-xs list-disc list-inside space-y-1">
                        <li><strong>WebDAV:</strong> Your Nextcloud/ownCloud server settings</li>
                        <li><strong>S3:</strong> AWS IAM - Users - Create Access Key</li>
                        <li><strong>B2:</strong> Backblaze - My Account - Application Keys</li>
                        <li><strong>FTP:</strong> Your hosting provider&apos;s FTP/SFTP details</li>
                      </ul>
                    </div>
                  );
                }
                return (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="font-semibold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
                      <span className="text-lg">📋</span> Step-by-Step Setup for {provider.name}
                    </p>
                    <ol className="space-y-2">
                      {provider.setupInstructions.map((inst) => (
                        <li key={inst.step} className="flex items-start gap-3 text-sm">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                            {inst.step}
                          </span>
                          <span className="text-blue-800 dark:text-blue-300">{inst.text}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); resetForm() }}
                className="flex-1 px-4 py-2 border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRemote}
                disabled={adding || !newRemoteName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {adding ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OAuth Modal for Google Drive */}
      {showOauthModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">
              Authorize Google Drive
            </h3>

            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                  Step 1: Run this command on your LOCAL computer (with web browser):
                </p>
                <code className="block bg-gray-800 text-green-400 p-3 rounded text-sm font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {oauthAuthorizeCmd}
                </code>
                <p className="text-yellow-700 dark:text-yellow-300 text-xs mt-2">
                  This opens a browser window. Log in with Google and authorize rclone.
                </p>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-blue-800 dark:text-blue-200 font-medium mb-2">
                  Step 2: After authorizing, the command outputs a token (JSON). Copy the ENTIRE output and paste below:
                </p>
                <textarea
                  value={oauthToken}
                  onChange={(e) => setOauthToken(e.target.value)}
                  placeholder='Paste the entire token here, for example: {"access_token":"ya29.a0...","refresh_token":"1//0g...","token_type":"Bearer",...}'
                  className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded px-3 py-2 h-32 text-sm font-mono"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowOauthModal(false); setOauthToken('') }}
                className="flex-1 px-4 py-2 border dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitOauthToken}
                disabled={oauthLoading || !oauthToken.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {oauthLoading ? 'Connecting...' : 'Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
