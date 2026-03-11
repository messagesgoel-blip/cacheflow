'use client'

import { useState, useEffect } from 'react'
import TwoFAPanel from '@/components/settings/TwoFAPanel'
import Navbar from '@/components/Navbar'
import { logoutClientSession, useClientSession } from '@/lib/auth/clientSession'

export default function SecuritySettingsPage() {
  const { authenticated, email, loading } = useClientSession()

  if (loading || !authenticated) {
    return (
      <div className="cf-shell-page flex min-h-screen items-center justify-center px-4">
        <div className="cf-panel w-full max-w-md rounded-[28px] p-8 text-center">
          <div className="cf-kicker">Security Access</div>
          <h1 className="mt-3 text-2xl font-semibold text-[var(--cf-text-0)]">Session required</h1>
          <p className="mt-3 text-sm text-[var(--cf-text-1)]">Please log in to manage security settings.</p>
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
        void logoutClientSession('/login')
      }} />
      <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-6 sm:px-6">
        <section className="cf-panel overflow-hidden rounded-[32px]">
          <div className="grid gap-5 border-b border-[var(--cf-border)] px-6 py-7 lg:grid-cols-[minmax(0,1.35fr)_420px] lg:px-8">
            <div>
              <div className="cf-kicker">Security Controls</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--cf-text-0)]">
                Lock down session access and recovery paths.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--cf-text-1)]">
                This surface stays tied to the existing 2FA endpoints and session model. No credential storage or provider auth behavior changes here.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <div className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 text-[11px] text-[var(--cf-text-2)]">
                  HttpOnly session flow retained
                </div>
                <div className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 text-[11px] text-[var(--cf-text-2)]">
                  Existing 2FA endpoints only
                </div>
                <div className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 text-[11px] text-[var(--cf-text-2)]">
                  No provider auth changes
                </div>
              </div>
            </div>
            <div className="cf-subpanel rounded-[28px] p-5">
              <div className="cf-kicker">Coverage</div>
              <div className="mt-4 space-y-3">
                <div className="rounded-[24px] border border-[rgba(0,201,167,0.24)] bg-[rgba(0,201,167,0.08)] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-[var(--cf-text-2)]">Active Guardrail</div>
                  <div className="mt-2 text-lg font-semibold text-[var(--cf-teal)]">Two-Factor Auth</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--cf-text-1)]">OTP challenge plus recovery code visibility during setup.</p>
                </div>
                <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-[var(--cf-text-2)]">Session</div>
                  <div className="mt-2 text-sm font-medium text-[var(--cf-text-0)]">{email}</div>
                  <p className="mt-1 text-xs leading-5 text-[var(--cf-text-1)]">Authenticated with existing HttpOnly session flow.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
            <TwoFAPanel />
            <aside className="cf-subpanel rounded-[28px] p-5">
              <div className="cf-kicker">Operational Notes</div>
              <div className="mt-4 space-y-3 text-sm text-[var(--cf-text-1)]">
                <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                  Setup shows backup codes only during activation. If they are lost, disable and re-enable 2FA to regenerate a new set.
                </div>
                <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                  Disabling 2FA still uses the current password-confirm flow. No new backend policy has been introduced.
                </div>
                <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                  Preference cleanup remains on the main settings page; this route stays focused on verification, activation, and recovery posture only.
                </div>
              </div>
            </aside>
          </div>
        </section>
        <div className="mt-4 px-2 text-xs uppercase tracking-[0.16em] text-[var(--cf-text-2)]">
          Route: `/settings/security`
        </div>
      </div>
    </div>
  )
}
