'use client'

import { Button } from '@/components/ui/Button'
import { Alert, AlertDescription } from '@/components/ui/Alert'

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
        <Alert variant="warning" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div 
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              style={{ 
                backgroundColor: 'var(--accent-amber-soft)',
                borderColor: 'var(--accent-amber)',
                borderWidth: '1px',
                color: 'var(--accent-amber)'
              }}
            >
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
              <AlertDescription style={{ color: 'var(--text-primary)' }}>
                Session attention required
              </AlertDescription>
              <p style={{ color: 'var(--text-primary)' }} className="mt-1 text-base font-semibold">Provider session expired</p>
              <p style={{ color: 'var(--text-secondary)' }} className="mt-1 text-sm">{email || accountName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button variant="secondary" size="sm" onClick={onReauth}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              Re-authenticate
            </Button>

            <Button variant="ghost" size="icon" onClick={onDismiss} aria-label="Dismiss" title="Dismiss for now">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </Alert>
      </div>
    </div>
  )
}
