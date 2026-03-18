import SettingsPanel from '@/components/SettingsPanel'

export default function SettingsPage() {
  const email = 'user@example.com' // Placeholder for server component

  return (
    <div>
      <div className="mx-auto max-w-[1600px] px-4 pb-10 pt-6 sm:px-6">
        <section className="cf-panel overflow-hidden rounded-[32px]">
          <div className="grid gap-5 border-b border-[var(--cf-border)] px-6 py-7 lg:grid-cols-[minmax(0,1.35fr)_420px] lg:px-8">
            <div>
              <div className="cf-kicker">Preferences Surface</div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--cf-text-0)]">
                Shape how CacheFlow behaves for this session.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--cf-text-1)]">
                Tune token handling, cache behavior, and theme defaults without changing any backend contracts.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <div className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 text-[11px] text-[var(--cf-text-2)]">
                  HttpOnly auth session preserved
                </div>
                <div className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 text-[11px] text-[var(--cf-text-2)]">
                  No provider token exposure
                </div>
                <div className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 text-[11px] text-[var(--cf-text-2)]">
                  Local UI persistence only
                </div>
              </div>
            </div>
            <div className="cf-subpanel rounded-[28px] p-5">
              <div className="cf-kicker">Current Profile</div>
              <div className="mt-4 space-y-3">
                <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-[var(--cf-text-2)]">Session Email</div>
                  <div className="mt-2 text-sm font-medium text-[var(--cf-text-0)]">{email}</div>
                  <p className="mt-2 text-xs leading-5 text-[var(--cf-text-1)]">Authenticated via the current cookie-backed session.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                    <div className="cf-kicker">Scope</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--cf-blue)]">Local</div>
                    <p className="mt-1 text-xs leading-5 text-[var(--cf-text-1)]">UI preferences only</p>
                  </div>
                  <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                    <div className="cf-kicker">Mode</div>
                    <div className="mt-2 text-lg font-semibold text-[var(--cf-teal)]">Safe</div>
                    <p className="mt-1 text-xs leading-5 text-[var(--cf-text-1)]">No provider auth changes</p>
                  </div>
                </div>
                <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
                  <div className="cf-kicker">Linked Security</div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-[var(--cf-text-0)]">Two-factor and recovery</div>
                      <p className="mt-1 text-xs leading-5 text-[var(--cf-text-1)]">Security controls stay on their dedicated surface.</p>
                    </div>
                    <a
                      href="/settings/security"
                      className="rounded-2xl border border-[var(--cf-border)] px-3 py-2 text-sm font-medium text-[var(--cf-text-1)] transition hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
                    >
                      Open
                    </a>
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
