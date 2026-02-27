'use client'
import { useState, useEffect, useCallback } from 'react'
import Login from '@/components/Login'
import Navbar from '@/components/Navbar'
import UsageBar from '@/components/UsageBar'
import FileBrowser from '@/components/FileBrowser'
import DrivePanel from '@/components/DrivePanel'
import FolderTree from '@/components/FolderTree'
import { getFiles, getUsage } from '@/lib/api'

// Simple error boundary wrapper
function withErrorBoundary<P extends object>(Component: React.ComponentType<P>) {
  return function ErrorWrapped(props: P) {
    const [error, setError] = useState<Error | null>(null)
    useEffect(() => {
      const handleError = (e: ErrorEvent) => {
        console.error('Global error:', e.error)
        setError(e.error)
      }
      window.addEventListener('error', handleError)
      return () => window.removeEventListener('error', handleError)
    }, [])
    if (error) {
      return <div className="p-8"><h1 className="text-red-600 dark:text-red-400">Error: {error.message}</h1></div>
    }
    return <Component {...props} />
  }
}

export default function Home() {
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [files, setFiles] = useState<any[]>([])
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [currentPath, setCurrentPath] = useState('/')
  const [selectedLocationId, setSelectedLocationId] = useState('local-cache')
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

  function handleLocationSelect(locationId: string) {
    setSelectedLocationId(locationId)
    setCurrentPath('/')
  }

  if (!token) return <Login onLogin={handleLogin} initialMode={loginMode} />

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar email={email} onLogout={handleLogout} />
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <UsageBar usage={usage} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left sidebar - Folder tree and Drive panel */}
          <div className="lg:col-span-1 space-y-6">
            <div id="folder-tree">
              <FolderTree
                token={token}
                locationId={selectedLocationId}
                currentPath={currentPath}
                onFolderSelect={setCurrentPath}
                onRefresh={() => refresh(token)}
              />
            </div>
            <div id="drive-panel">
              <DrivePanel
                token={token}
                onLocationSelect={handleLocationSelect}
                onRefresh={() => refresh(token)}
              />
            </div>
          </div>

          {/* Main content - File browser */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <FileBrowser
                token={token}
                currentPath={currentPath}
                locationId={selectedLocationId}
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
