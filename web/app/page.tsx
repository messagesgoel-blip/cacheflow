'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Login from '@/components/Login'
import UsageBar from '@/components/UsageBar'
import FileTable from '@/components/FileTable'
import { getFiles, getUsage, uploadFile } from '@/lib/api'

export default function Home() {
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [files, setFiles] = useState<any[]>([])
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
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
    if (t && e) { setToken(t); setEmail(e); refresh(t) }
  }, [refresh])

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

  if (!token) return <Login onLogin={handleLogin} />

  return (
    <div className="min-h-screen">
      <nav className="bg-blue-700 text-white px-6 py-3 flex justify-between items-center shadow">
        <span className="font-bold text-lg tracking-tight">CacheFlow</span>
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
          <FileTable files={files} token={token} onRefresh={() => refresh(token)} />
        </div>
      </main>
    </div>
  )
}
