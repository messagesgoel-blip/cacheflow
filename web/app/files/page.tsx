'use client'

import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import UnifiedFileBrowser from '@/components/UnifiedFileBrowser'

interface SessionResponse {
  authenticated?: boolean
  user?: {
    email?: string
  }
}

export default function FilesPage() {
  const [token, setToken] = useState<string | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const hydrateSession = async () => {
      const localToken = localStorage.getItem('cf_token')
      const localEmail = localStorage.getItem('cf_email') || ''

      try {
        const res = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        })

        if (!res.ok) {
          if (isMounted) {
            setToken(null)
            setAuthenticated(false)
            setEmail('')
          }
          localStorage.removeItem('cf_token')
          localStorage.removeItem('cf_email')
          return
        }

        const session = (await res.json()) as SessionResponse
        if (!isMounted) return

        if (session.authenticated) {
          setAuthenticated(true)
          setToken(localToken || '')
          setEmail(session.user?.email || localEmail)
        } else {
          setToken(null)
          setAuthenticated(false)
          setEmail('')
          localStorage.removeItem('cf_token')
          localStorage.removeItem('cf_email')
        }
      } catch {
        if (isMounted) {
          if (localToken) {
            setToken(localToken)
            setAuthenticated(true)
            setEmail(localEmail)
          } else {
            setToken(null)
            setAuthenticated(false)
            setEmail('')
          }
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    hydrateSession()
    return () => {
      isMounted = false
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Loading files…</p>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Please log in to browse your files</p>
          <a
            href="/?mode=login"
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
      <Navbar
        email={email}
        onLogout={() => {
          localStorage.removeItem('cf_token')
          localStorage.removeItem('cf_email')
          window.location.href = '/login'
        }}
      />
      <main className="p-4 md:p-6">
        <UnifiedFileBrowser token={token || ''} />
      </main>
    </div>
  )
}
