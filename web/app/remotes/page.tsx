'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import RemotesPanel from '@/components/RemotesPanel'

export default function RemotesPage() {
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const router = useRouter()

  useEffect(() => {
    const t = localStorage.getItem('cf_token')
    const e = localStorage.getItem('cf_email')
    if (!t || !e) {
      router.push('/login')
    } else {
      setToken(t)
      setEmail(e)
    }
  }, [router])

  function handleLogout() {
    localStorage.removeItem('cf_token')
    localStorage.removeItem('cf_email')
    router.push('/login')
  }

  if (!token) return null

  return (
    <div className="min-h-screen">
      <nav className="bg-blue-700 text-white px-6 py-3 flex justify-between items-center shadow">
        <div className="flex items-center gap-6">
          <span className="font-bold text-lg tracking-tight">CacheFlow</span>
          <div className="flex gap-4">
            <a href="/" className="text-blue-200 hover:text-white text-sm">Files</a>
            <a href="/remotes" className="text-white font-medium text-sm">Cloud Drives</a>
            <a href="/conflicts" className="text-blue-200 hover:text-white text-sm">Conflicts</a>
            <a href="/admin" className="text-blue-200 hover:text-white text-sm">Admin</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-blue-200 text-sm">{email}</span>
          <button onClick={handleLogout} className="text-sm bg-blue-800 px-3 py-1 rounded hover:bg-blue-900">Logout</button>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <RemotesPanel token={token} />
      </main>
    </div>
  )
}
