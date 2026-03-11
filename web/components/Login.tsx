'use client'

import { useState } from 'react'
import { login, register } from '@/lib/api'
import ThemeToggle from './ThemeToggle'

export default function Login({
  onLogin,
  initialMode = 'login',
}: {
  onLogin: (token: string, email: string) => void
  initialMode?: 'login' | 'register'
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const action = mode === 'login' ? login : register
      const data = await action(email, password)
      if (data.token) {
        onLogin(data.token, data?.user?.email || email)
      } else {
        setError(data.error || (mode === 'login' ? 'Login failed' : 'Registration failed'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="cf-shell-page relative box-border"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div className="absolute right-4 top-4 z-20 rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-1 shadow-[var(--cf-shadow-elev)]">
        <ThemeToggle />
      </div>

      <div className="grid w-full max-w-6xl items-stretch gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="cf-liquid relative hidden self-stretch overflow-hidden rounded-[36px] p-8 lg:flex lg:min-h-[620px] lg:flex-col lg:justify-between xl:p-10">
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(116,174,252,0.62),transparent)]" />
          <div>
            <p className="cf-kicker">CacheFlow access surface</p>
            <h1 className="mt-4 max-w-lg text-4xl font-semibold tracking-[-0.05em] text-[var(--cf-text-0)] xl:text-5xl">
              One control plane for every file surface you already run.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--cf-text-1)]">
              Browse cloud providers, server mounts, and transfer activity from a single shell without changing your existing backend or provider contracts.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="cf-panel rounded-[24px] p-5">
              <p className="cf-kicker">Storage</p>
              <p className="mt-3 text-lg font-semibold text-[var(--cf-text-0)]">Cloud and VPS scopes</p>
              <p className="mt-2 text-sm text-[var(--cf-text-1)]">Google Drive, Dropbox, WebDAV, VPS/SFTP, and more in one browser workspace.</p>
            </div>
            <div className="cf-panel rounded-[24px] p-5">
              <p className="cf-kicker">Auth</p>
              <p className="mt-3 text-lg font-semibold text-[var(--cf-text-0)]">Cookie-first session flow</p>
              <p className="mt-2 text-sm text-[var(--cf-text-1)]">Session state stays server-backed while the shell remains responsive across routes.</p>
            </div>
            <div className="cf-panel rounded-[24px] p-5">
              <p className="cf-kicker">Ops</p>
              <p className="mt-3 text-lg font-semibold text-[var(--cf-text-0)]">Transfers, previews, and control</p>
              <p className="mt-2 text-sm text-[var(--cf-text-1)]">Move between providers, inspect content, and keep the control plane readable under load.</p>
            </div>
          </div>
        </section>

        <section className="cf-liquid relative flex self-stretch overflow-hidden rounded-[32px] p-6 sm:p-8 lg:min-h-[620px] lg:flex-col lg:p-10">
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,224,194,0.54),transparent)]" />
          <div className="mx-auto flex h-full w-full max-w-md flex-1 flex-col justify-center">
            <p className="cf-kicker">{mode === 'login' ? 'Welcome back' : 'Create access'}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--cf-text-0)]">
              {mode === 'login' ? 'Enter the control plane.' : 'Start a new CacheFlow session.'}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--cf-text-1)]">
              {mode === 'login'
                ? 'Sign in to return to files, providers, transfer activity, and session settings.'
                : 'Register a new account to access the browser shell and linked storage surfaces.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <label className="block">
                <span className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--cf-text-2)]">Email</span>
                <input
                  data-testid="email-input"
                  className="w-full rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3 text-sm text-[var(--cf-text-0)] outline-none transition focus:border-[rgba(74,158,255,0.32)] focus:bg-[var(--cf-panel-softer)]"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--cf-text-2)]">Password</span>
                <input
                  data-testid="password-input"
                  className="w-full rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3 text-sm text-[var(--cf-text-0)] outline-none transition focus:border-[rgba(74,158,255,0.32)] focus:bg-[var(--cf-panel-softer)]"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </label>
              {error && <p className="rounded-2xl border border-[rgba(255,92,92,0.2)] bg-[rgba(255,92,92,0.08)] px-4 py-3 text-sm text-[var(--cf-red)]">{error}</p>}
              <button
                data-testid="submit-button"
                className="w-full rounded-2xl border border-[rgba(74,158,255,0.34)] bg-[linear-gradient(135deg,rgba(74,158,255,0.88),rgba(43,104,223,0.92))] px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={loading}
              >
                {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign In' : 'Register')}
              </button>
              <button
                data-testid="toggle-mode-button"
                className="w-full rounded-2xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-3 text-sm font-medium text-[var(--cf-text-1)] transition hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)] disabled:opacity-50"
                type="button"
                disabled={loading}
                onClick={() => {
                  setError('')
                  setMode(mode === 'login' ? 'register' : 'login')
                }}
              >
                {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Sign In'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}
