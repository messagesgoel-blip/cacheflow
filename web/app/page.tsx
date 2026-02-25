'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Login from '@/components/Login'
import UsageBar from '@/components/UsageBar'
import FileBrowser from '@/components/FileBrowser'
import DrivePanel from '@/components/DrivePanel'
import FolderTree from '@/components/FolderTree'
import { getFiles, getUsage, uploadFile } from '@/lib/api'

export default function Home() {
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [files, setFiles] = useState<any[]>([])
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [currentPath, setCurrentPath] = useState('/')
  const [loginMode, setLoginMode] = useState<'login' | 'register'>('login')

  const refresh = useCallback(async (t: string) => {
    setLoading(true)
    try {
      const [f, u] = await Promise.all([getFiles(t), getUsage(t)])
      setFiles(f.files || [])
      setUsage(u)
    } catch (error) {
      console.error('Refresh failed:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = localStorage.getItem('cf_token')
    const e = localStorage.getItem('cf_email')
    if (t && e) { setToken(t); setEmail(e); refresh(t) }
  }, [refresh])

  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get('mode')
    setLoginMode(mode === 'register' ? 'register' : 'login')
  }, [])

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

  if (!token) return <Login onLogin={handleLogin} initialMode={loginMode} />

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
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <UsageBar usage={usage} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left sidebar - Folder tree and Drive panel */}
          <div className="lg:col-span-1 space-y-6">
            <FolderTree
              token={token}
              currentPath={currentPath}
              onFolderSelect={setCurrentPath}
              onRefresh={() => refresh(token)}
            />
            <DrivePanel
              token={token}
              onRefresh={() => refresh(token)}
            />
          </div>

          {/* Main content - File browser */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow p-6">
              <FileBrowser
                token={token}
                currentPath={currentPath}
                onPathChange={setCurrentPath}
                onRefresh={() => refresh(token)}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
