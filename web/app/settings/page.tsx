'use client'

import { useState, useEffect } from 'react'
import SettingsPanel from '@/components/SettingsPanel'
import Navbar from '@/components/Navbar'

export default function SettingsPage() {
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
      <div className="cf-shell-page flex min-h-screen items-center justify-center px-4">
        <div className="cf-panel w-full max-w-md rounded-[28px] p-8 text-center">
          <div className="cf-kicker">Settings Access</div>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--cf-text-0)]">Session required</h1>
          <p className="mt-3 text-sm text-[var(--cf-text-1)]">Please log in to access settings.</p>
          <a
            href="/login"
            className="mt-6 inline-flex rounded-2xl border border-[rgba(74,158,255,0.28)] bg-[rgba(74,158,255,0.14)] px-4 py-2 text-sm font-semibold text-[var(--cf-blue)] transition hover:bg-[rgba(74,158,255,0.2)]"
          >
            Log In
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="cf-shell-page min-h-screen">
      <Navbar email={email} onLogout={() => {
        localStorage.removeItem('cf_token')
        localStorage.removeItem('cf_email')
        window.location.href = '/login'
      }} />
      <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-6 sm:px-6">
        <section className="cf-panel overflow-hidden rounded-[32px]">
          <div className="grid gap-6 border-b border-[var(--cf-border)] px-6 py-7 lg:grid-cols-[minmax(0,1.45fr)_360px] lg:px-8">
            <div>
              <div className="cf-kicker">Preferences Surface</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--cf-text-0)]">
                Shape how CacheFlow behaves for this session.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--cf-text-1)]">
                Tune token handling, cache behavior, and theme defaults without changing any backend contracts.
              </p>
            </div>
            <div className="cf-subpanel rounded-[28px] p-5">
              <div className="cf-kicker">Current Profile</div>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.16em] text-[var(--cf-text-2)]">Session Email</div>
                  <div className="mt-1 text-sm font-medium text-[var(--cf-text-0)]">{email}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                    <div className="cf-kicker">Scope</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--cf-blue)]">Local</div>
                    <p className="mt-1 text-xs leading-5 text-[var(--cf-text-1)]">UI preferences only</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                    <div className="cf-kicker">Mode</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--cf-teal)]">Safe</div>
                    <p className="mt-1 text-xs leading-5 text-[var(--cf-text-1)]">No provider auth changes</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <SettingsPanel />
        </section>
      </div>
    </div>
  )
}
