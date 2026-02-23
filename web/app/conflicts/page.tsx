'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ConflictList from '@/components/ConflictList'

export default function ConflictsPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  useEffect(() => {
    const t = localStorage.getItem('cf_token')
    const e = localStorage.getItem('cf_email')

    if (!t) {
      router.push('/')
      return
    }

    setToken(t)
    setEmail(e || '')
  }, [router])

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  function handleLogout() {
    localStorage.removeItem('cf_token')
    localStorage.removeItem('cf_email')
    router.push('/')
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-blue-700 text-white px-6 py-3 flex justify-between items-center shadow">
        <div className="flex items-center gap-6">
          <span className="font-bold text-lg tracking-tight">CacheFlow</span>
          <div className="flex gap-4">
            <a href="/" className="text-blue-200 hover:text-white text-sm">Files</a>
            <a href="/conflicts" className="text-white font-medium text-sm">Conflicts</a>
            <a href="/admin" className="text-blue-200 hover:text-white text-sm">Admin</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-blue-200 text-sm">{email}</span>
          <button onClick={handleLogout} className="text-sm bg-blue-800 px-3 py-1 rounded hover:bg-blue-900">Logout</button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">Conflict Resolution</h1>
              <p className="text-gray-600 text-sm mt-1">Resolve conflicts between local and cloud versions of your files</p>
            </div>
            <a
              href="/"
              className="text-sm text-blue-600 hover:underline"
            >
              ← Back to Files
            </a>
          </div>

          <ConflictList token={token} />
        </div>
      </main>
    </div>
  )
}