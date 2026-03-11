'use client'

interface SessionExpiredBannerProps {
  accountName: string
  email?: string
  onReauth: () => void
  onDismiss: () => void
}

export default function SessionExpiredBanner({
  accountName,
  email,
  onReauth,
  onDismiss,
}: SessionExpiredBannerProps) {
  return (
    <div className="relative z-50 px-3 pt-3 md:px-4">
      <div className="mx-auto max-w-[1600px]">
        <div className="cf-panel flex flex-col gap-3 rounded-[24px] border border-[rgba(255,179,92,0.34)] bg-[linear-gradient(135deg,rgba(255,145,67,0.2),rgba(255,118,118,0.14))] px-4 py-3 text-[var(--cf-text-0)] shadow-[0_24px_60px_rgba(143,67,14,0.18)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.26)] bg-[rgba(255,255,255,0.18)] text-[var(--cf-amber)]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="cf-kicker text-[rgba(97,46,7,0.72)] dark:text-[rgba(255,236,214,0.74)]">Session attention required</p>
              <p className="mt-1 text-base font-semibold text-[var(--cf-text-0)]">Provider session expired</p>
              <p className="mt-1 text-sm text-[var(--cf-text-1)]">{email || accountName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={onReauth}
              className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(255,255,255,0.4)] bg-[rgba(255,255,255,0.82)] px-4 py-2 text-sm font-semibold text-[#9a4900] shadow-sm transition hover:bg-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              Re-authenticate
            </button>

            <button
              onClick={onDismiss}
              className="rounded-2xl p-2 text-[rgba(97,46,7,0.72)] transition hover:bg-[rgba(255,255,255,0.18)] hover:text-[var(--cf-text-0)] dark:text-[rgba(255,236,214,0.74)]"
              aria-label="Dismiss"
              title="Dismiss for now"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
