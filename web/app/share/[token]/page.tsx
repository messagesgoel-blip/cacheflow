'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8100'

interface ShareData {
  file: {
    id: string
    path: string
    size_bytes: number
    created_at: string
    download_count: number
  }
  password_protected: boolean
  expires_at?: string
  download_limit?: number
}

export default function SharePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [requiresPassword, setRequiresPassword] = useState(false)

  useEffect(() => {
    fetchShareData()
  }, [token])

  async function fetchShareData(password?: string) {
    setLoading(true)
    setError(null)
    setPasswordError(null)

    try {
      const headers: Record<string, string> = {}
      if (password) {
        headers['X-Share-Password'] = password
      }

      const res = await fetch(`${API}/share/${token}`, { headers })

      if (res.status === 410) {
        setError('This share link has expired or reached its download limit.')
        return
      }

      if (res.status === 401) {
        setRequiresPassword(true)
        return
      }

      if (!res.ok) {
        throw new Error(`Failed to load share: ${res.status}`)
      }

      const data = await res.json()
      setShareData(data)
      setRequiresPassword(false)
    } catch (err: any) {
      setError(err.message || 'Failed to load share')
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) {
      setPasswordError('Password is required')
      return
    }
    await fetchShareData(password)
  }

  async function handleDownload() {
    if (!shareData) return

    setDownloading(true)
    try {
      const headers: Record<string, string> = {}
      if (requiresPassword && password) {
        headers['X-Share-Password'] = password
      }

      const res = await fetch(`${API}/share/${token}`, { headers })

      if (!res.ok) {
        throw new Error(`Download failed: ${res.status}`)
      }

      const blob = await res.blob()
      const filename = shareData.file.path.split('/').pop() || 'download'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Refresh share data to update download count
      await fetchShareData(requiresPassword ? password : undefined)
    } catch (err: any) {
      alert('Download failed: ' + err.message)
    } finally {
      setDownloading(false)
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading share...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Link Unavailable</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Go to CacheFlow
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (requiresPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Password Required</h2>
            <p className="text-gray-600 mt-2">This share link is protected with a password.</p>
          </div>
          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="Enter password"
                autoFocus
              />
              {passwordError && (
                <p className="text-red-500 text-sm mt-1">{passwordError}</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (!shareData) {
    return null
  }

  const { file } = shareData
  const filename = file.path.split('/').pop() || 'Unknown file'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Shared File</h1>
            <p className="text-gray-600">Download the file below</p>
          </div>

          <div className="space-y-6">
            <div className="border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 truncate">{filename}</h2>
                  <p className="text-sm text-gray-500 mt-1">Shared via CacheFlow</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Downloads</div>
                  <div className="text-xl font-semibold">{file.download_count}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">File size</div>
                  <div className="font-medium">{formatFileSize(file.size_bytes)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Uploaded</div>
                  <div className="font-medium">{formatDate(file.created_at)}</div>
                </div>
              </div>

              {shareData.expires_at && (
                <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200 text-sm">
                  <span className="font-medium">Note:</span> This link expires on {formatDate(shareData.expires_at)}
                </div>
              )}

              {shareData.download_limit && (
                <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200 text-sm">
                  <span className="font-medium">Note:</span> Limited to {shareData.download_limit} downloads
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {downloading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Downloading...
                  </>
                ) : (
                  'Download File'
                )}
              </button>
            </div>

            <div className="text-center">
              <button
                onClick={() => router.push('/')}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                ← Go to CacheFlow
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}