'use client'

import { useState, useEffect } from 'react'
import UnifiedFileBrowser from '@/components/UnifiedFileBrowser'
import Navbar from '@/components/Navbar'

export default function FilesPage() {
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  useEffect(() => {
    const t = localStorage.getItem('cf_token')
    const e = localStorage.getItem('cf_email')
    if (t && e) {
      setToken(t)
      setEmail(e)
    }
  }, [])

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Please log in to browse your files</p>
          <a
            href="/login"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Log In
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar email={email} onLogout={() => {
        localStorage.removeItem('cf_token')
        localStorage.removeItem('cf_email')
        window.location.href = '/login'
      }} />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <UnifiedFileBrowser token={token} />
      </div>
    </div>
  )
}
