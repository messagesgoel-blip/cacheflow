'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Login from '@/components/Login'
import UsageBar from '@/components/UsageBar'
import FileTable from '@/components/FileTable'
import Breadcrumb from '@/components/Breadcrumb'
import { getFiles, getUsage, uploadFile } from '@/lib/api'

export default function Home() {
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [files, setFiles] = useState<any[]>([])
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<string>('date-newest')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async (t: string) => {
    setLoading(true)
    const [f, u] = await Promise.all([getFiles(t), getUsage(t)])
    setFiles(f.files || [])
    setUsage(u)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = localStorage.getItem('cf_token')
    const e = localStorage.getItem('cf_email')
    const savedViewMode = localStorage.getItem('cf_view_mode') as 'list' | 'grid'
    if (t && e) { setToken(t); setEmail(e); refresh(t) }
    if (savedViewMode && (savedViewMode === 'list' || savedViewMode === 'grid')) {
      setViewMode(savedViewMode)
    }
  }, [refresh])

  // Auto-poll every 5s while any file is pending or syncing
  useEffect(() => {
    if (!token) return
    const hasActive = files.some(f => f.status === 'pending' || f.status === 'syncing')
    if (!hasActive) return
    const id = setInterval(() => refresh(token), 5000)
    return () => clearInterval(id)
  }, [token, files, refresh])

  function handleLogin(t: string, e: string) {
    localStorage.setItem('cf_token', t)
    localStorage.setItem('cf_email', e)
    setToken(t); setEmail(e); refresh(t)
  }

  function handleLogout() {
    localStorage.removeItem('cf_token')
    localStorage.removeItem('cf_email')
    setToken(null); setEmail(''); setFiles([]); setUsage(null)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return

    setUploading(true)
    setUploadError(null)

    try {
      await uploadFile(file, token)
      // Refresh file list and usage after successful upload
      await refresh(token)
    } catch (err: any) {
      // Check if it's a quota exceeded error (413)
      if (err.message.includes('413') || err.message.includes('Quota exceeded')) {
        setUploadError('Quota exceeded. Please delete some files or upgrade your plan.')
      } else {
        setUploadError(err.message || 'Upload failed')
      }
    } finally {
      setUploading(false)
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function triggerFileInput() {
    fileInputRef.current?.click()
  }

  function toggleViewMode() {
    const newMode = viewMode === 'list' ? 'grid' : 'list'
    setViewMode(newMode)
    localStorage.setItem('cf_view_mode', newMode)
  }

  // Count files by status
  const statusCounts = {
    all: files.length,
    synced: files.filter(f => f.status === 'synced').length,
    pending: files.filter(f => f.status === 'pending').length,
    syncing: files.filter(f => f.status === 'syncing').length,
    error: files.filter(f => f.status === 'error').length,
  }

  const filteredFiles = files.filter(f => {
    if (activeFilter === 'all') return true
    return f.status === activeFilter
  })

  const sortOrder = sortBy
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    switch (sortBy) {
      case 'name-asc':
        return (a.path.split('/').pop() || '').localeCompare(b.path.split('/').pop() || '')
      case 'name-desc':
        return (b.path.split('/').pop() || '').localeCompare(a.path.split('/').pop() || '')
      case 'size-large':
        return b.size_bytes - a.size_bytes
      case 'size-small':
        return a.size_bytes - b.size_bytes
      case 'date-newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'date-oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      default:
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })

  if (!token) return <Login onLogin={handleLogin} />

  return (
    <div className="min-h-screen">
      <nav className="bg-blue-700 text-white px-6 py-3 flex justify-between items-center shadow">
        <div className="flex items-center gap-6">
          <span className="font-bold text-lg tracking-tight">CacheFlow</span>
          <div className="flex gap-4">
            <a href="/" className="text-white font-medium text-sm">Files</a>
            <a href="/conflicts" className="text-blue-200 hover:text-white text-sm">Conflicts</a>
            <a href="/admin" className="text-blue-200 hover:text-white text-sm">Admin</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-blue-200 text-sm">{email}</span>
          <button onClick={handleLogout} className="text-sm bg-blue-800 px-3 py-1 rounded hover:bg-blue-900">Logout</button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <UsageBar usage={usage} />
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-700">Files</h2>
            <div className="flex items-center gap-3">
              <button onClick={() => refresh(token)} disabled={loading}
                className="text-sm text-blue-600 hover:underline disabled:opacity-50">
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button onClick={triggerFileInput} disabled={uploading}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
          />
          {uploadError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200 text-sm">
              {uploadError}
            </div>
          )}
          <Breadcrumb path="My Files" />
          <div className="mb-4 flex flex-wrap gap-2">
            {['all', 'synced', 'pending', 'syncing', 'error'].map(status => (
              <button
                key={status}
                onClick={() => setActiveFilter(status)}
                className={`px-3 py-1 text-sm rounded border ${activeFilter === status ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'} ${status === 'error' && statusCounts.error > 0 ? 'text-red-700' : ''}`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="ml-1 text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                  {statusCounts[status as keyof typeof statusCounts]}
                </span>
              </button>
            ))}
          </div>
          <div className="mb-4 flex items-center gap-3">
            <label htmlFor="sortBy" className="text-sm text-gray-600">Sort</label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="sort order"
              data-sort-order={sortOrder}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="date-newest">Date (newest)</option>
              <option value="date-oldest">Date (oldest)</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="size-large">Size (largest)</option>
              <option value="size-small">Size (smallest)</option>
            </select>
            <button
              onClick={toggleViewMode}
              className="border rounded px-2 py-1 text-sm bg-gray-50 hover:bg-gray-100"
            >
              {viewMode === 'list' ? 'Grid' : 'List'}
            </button>
          </div>
          <FileTable files={sortedFiles} token={token} onRefresh={() => refresh(token)} viewMode={viewMode} />
        </div>
      </main>
    </div>
  )
}
