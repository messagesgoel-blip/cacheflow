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
      <div className="cf-shell-page flex min-h-screen items-center justify-center">
        <p className="font-mono text-sm text-[var(--cf-text-2)]">Loading files…</p>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="cf-shell-page flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-[var(--cf-text-1)]">Please log in to browse your files</p>
          <a
            href="/?mode=login"
            className="rounded-xl border border-[rgba(74,158,255,0.32)] bg-[rgba(74,158,255,0.14)] px-4 py-2 text-[var(--cf-blue)] transition-colors hover:bg-[rgba(74,158,255,0.2)]"
          >
            Log In
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="cf-shell-page">
      <Navbar
        email={email}
        onLogout={() => {
          localStorage.removeItem('cf_token')
          localStorage.removeItem('cf_email')
          window.location.href = '/login'
        }}
      />
      <main className="mx-auto max-w-[1600px] p-4 md:p-6">
        <UnifiedFileBrowser token={token || ''} />
      </main>
    </div>
  )
}
