'use client'

import { useState, useEffect } from 'react'
import ProviderHub from '@/components/ProviderHub'
import Navbar from '@/components/Navbar'
import MissionControl from '@/components/MissionControl'
import { IntegrationProvider } from '@/context/IntegrationContext'
import ConnectProviderModal from '@/components/modals/ConnectProviderModal'
import WebDAVModal from '@/components/modals/WebDAVModal'
import VPSModal from '@/components/modals/VPSModal'
import { logoutClientSession, useClientSession } from '@/lib/auth/clientSession'

export default function ProvidersPage() {
  const { authenticated, email, loading } = useClientSession({ redirectTo: '/login?reason=session_expired' })

  if (loading || !authenticated) {
    return (
      <div className="cf-shell-page flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--cf-blue)]" />
      </div>
    )
  }

  return (
    <IntegrationProvider>
      <div className="cf-shell-page relative z-0 min-h-screen overflow-auto">
        <Navbar email={email || 'Account'} onLogout={() => { void logoutClientSession('/login') }} />
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
