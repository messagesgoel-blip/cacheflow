'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import UnifiedFileBrowser from '@/components/UnifiedFileBrowser'
import Navbar from '@/components/Navbar'
import MissionControl from '@/components/MissionControl'
import { logoutClientSession, useClientSession } from '@/lib/auth/clientSession'

function FilesBrowserShell({ token }: { token: string }) {
  const searchParams = useSearchParams()

  return <UnifiedFileBrowser token={token} routeView={searchParams.get('view') === 'activity' ? 'activity' : undefined} />
}

export default function FilesPage() {
  const { loading, authenticated, email } = useClientSession()

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
          void logoutClientSession('/login')
        }}
      />
      <main className="mx-auto max-w-[1600px] p-4 md:p-6">
        <MissionControl />
        <Suspense
          fallback={
            <div className="cf-panel rounded-[28px] px-5 py-8 text-sm text-[var(--cf-text-2)]">
              Loading files workspace…
            </div>
          }
        >
          <FilesBrowserShell token="" />
        </Suspense>
      </main>
    </div>
  )
}
