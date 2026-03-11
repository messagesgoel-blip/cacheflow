'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ClientSessionUser {
  id?: string | number | null
  email?: string
}

interface ClientSessionResponse {
  authenticated?: boolean
  user?: ClientSessionUser | null
}

interface UseClientSessionOptions {
  redirectTo?: string | null
}

export interface ClientSessionState {
  loading: boolean
  authenticated: boolean
  email: string
  user: ClientSessionUser | null
}

export function clearLegacyAuthState(): void {
  if (typeof window === 'undefined') return

  localStorage.removeItem('cf_token')
  localStorage.removeItem('cf_email')
  localStorage.removeItem('token')
}

export async function logoutClientSession(redirectTo = '/login'): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  } catch (error) {
    console.debug('[auth] logout failed, redirecting anyway', { error, redirectTo })
  }

  clearLegacyAuthState()
  window.location.href = redirectTo
}

export function useClientSession(options: UseClientSessionOptions = {}): ClientSessionState {
  const { redirectTo = null } = options
  const router = useRouter()
  const [state, setState] = useState<ClientSessionState>({
    loading: true,
    authenticated: false,
    email: '',
    user: null,
  })

  useEffect(() => {
    let active = true

    const loadSession = async () => {
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
          cache: 'no-store',
        })

        if (!response.ok) {
          if (!active) return
          clearLegacyAuthState()
          setState({
            loading: false,
            authenticated: false,
            email: '',
            user: null,
          })
          if (redirectTo) router.push(redirectTo)
          return
        }

        const payload = (await response.json()) as ClientSessionResponse
        if (!active) return

        const authenticated = Boolean(payload?.authenticated)
        const user = payload?.user || null
        setState({
          loading: false,
          authenticated,
          email: user?.email || '',
          user,
        })

        if (!authenticated && redirectTo) {
          router.push(redirectTo)
        }
      } catch {
        if (!active) return
        setState({
          loading: false,
          authenticated: false,
          email: '',
          user: null,
        })
        if (redirectTo) router.push(redirectTo)
      }
    }

    void loadSession()

    return () => {
      active = false
    }
  }, [redirectTo, router])

  return state
}
