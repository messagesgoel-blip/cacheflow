'use client'

import { useState, useEffect } from 'react'
import ProviderHub from '@/components/ProviderHub'
import Navbar from '@/components/Navbar'
import MissionControl from '@/components/MissionControl'
import { IntegrationProvider } from '@/context/IntegrationContext'
import ConnectProviderModal from '@/components/modals/ConnectProviderModal'
import WebDAVModal from '@/components/modals/WebDAVModal'
import VPSModal from '@/components/modals/VPSModal'
import { useRouter } from 'next/navigation'

export default function ProvidersPage() {
  const router = useRouter()
  const [email, setEmail] = useState('Account')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!response.ok) {
          router.push('/login?reason=session_expired')
          return
        }
        const payload = await response.json()
        if (!payload?.authenticated) {
          router.push('/login')
          return
        }
        setEmail(payload?.user?.email || 'Account')
      } finally {
        setReady(true)
      }
    }
    void loadSession()
  }, [router])

  const handleLogout = async () => {
    router.push('/login')
  }

  if (!ready) {
    return (
      <div className="cf-shell-page flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--cf-blue)]" />
      </div>
    )
  }

  return (
    <IntegrationProvider>
      <div className="cf-shell-page relative z-0 min-h-screen overflow-auto">
        <Navbar email={email} onLogout={handleLogout} />
        <main className="relative z-0 mx-auto max-w-[1600px] overflow-auto px-4 pb-6 pt-4 md:px-6 md:pb-6 md:pt-4">
          <MissionControl />
          <ProviderHub />
        </main>
        <ConnectProviderModal />
        <WebDAVModal />
        <VPSModal />
      </div>
    </IntegrationProvider>
  )
}
