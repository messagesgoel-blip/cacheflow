'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SessionExpiredBanner from './SessionExpiredBanner'

interface SessionState {
  expired: boolean
  reason?: string
  accountName: string
  email?: string
}

export default function SessionExpiredBannerHost() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sessionState, setSessionState] = useState<SessionState | null>(null)

  const handleReauth = useCallback(() => {
    // Default: redirect to providers page for OAuth flow
    const redirect = searchParams.get('redirect') || '/providers'
    router.push(redirect)
  }, [router, searchParams])

  const handleDismiss = useCallback(() => {
    setSessionState(null)
  }, [])

  // Check for session_expired in URL params
  useEffect(() => {
    const reason = searchParams.get('reason')
    if (reason === 'session_expired') {
      const accountName = searchParams.get('account') || 'Your account'
      const email = searchParams.get('email') || undefined

      setSessionState({
        expired: true,
        reason,
        accountName,
        email,
      })
      // Remove query params without reload
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [searchParams])

  // Listen for unhandled promise rejections with SESSION_EXPIRED
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      if (reason?.message === 'SESSION_EXPIRED') {
        event.preventDefault()
        setSessionState({ expired: true, accountName: 'Your account' })
      }
    }

    // Listen for custom reauth-required events
    const handleReauthRequired = (event: Event) => {
      const customEvent = event as CustomEvent<{ provider?: string; accountName?: string; accountEmail?: string; reason?: string }>
      setSessionState({
        expired: true,
        reason: customEvent.detail?.reason || 'Session expired',
        accountName: customEvent.detail?.accountName || 'Your account',
        email: customEvent.detail?.accountEmail,
      })
    }

    // Listen for session expired events from auth interceptor
    const handleSessionExpired = (event: Event) => {
      setSessionState({
        expired: true,
        reason: 'Session expired',
        accountName: 'Your account',
      })
    }

    window.addEventListener('unhandledrejection', handleRejection)
    window.addEventListener('cacheflow:reauth-required', handleReauthRequired)
    window.addEventListener('cacheflow:session-expired', handleSessionExpired)

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection)
      window.removeEventListener('cacheflow:reauth-required', handleReauthRequired)
      window.removeEventListener('cacheflow:session-expired', handleSessionExpired)
    }
  }, [])

  if (!sessionState?.expired) return null

  return (
    <SessionExpiredBanner
      accountName={sessionState.accountName}
      email={sessionState.email}
      onReauth={handleReauth}
      onDismiss={handleDismiss}
    />
  )
}
