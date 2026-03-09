'use client'

import { useEffect, useState } from 'react'
import { useTransferQueue } from './TransferQueueProvider'
import { PROVIDERS, formatBytes } from '@/lib/providers/types'

function providerName(providerId: string): string {
  return PROVIDERS.find((provider) => provider.id === providerId)?.name || providerId
}

function statusLabel(job: { type: string; status: string; progress: number }): string {
  if (job.status === 'completed') return 'Completed'
  if (job.status === 'failed') return 'Failed'
  if (job.status === 'pending') return job.type === 'move' ? 'Moving' : 'Copying'
  if (job.status === 'transferring') return `${job.type === 'move' ? 'Moving' : 'Copying'} ${Math.round(job.progress)}%`
  return job.status
}

function statusClass(status: string): string {
  if (status === 'failed') {
    return 'border-[rgba(255,92,92,0.24)] bg-[rgba(255,92,92,0.09)] text-[var(--cf-red)]'
  }
  if (status === 'completed') {
    return 'border-[rgba(74,222,128,0.24)] bg-[rgba(74,222,128,0.1)] text-[var(--cf-green)]'
  }
  return 'border-[rgba(74,158,255,0.24)] bg-[rgba(74,158,255,0.1)] text-[var(--cf-blue)]'
}

export default function TransferQueuePanel() {
  const { queue, retryTransfer, dismissTransfer, clearCompleted } = useTransferQueue()
  const [isMinimized, setIsCollapsed] = useState(false)
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false)

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const syncPreviewPanel = () => {
      setPreviewPanelOpen(Boolean(document.querySelector('[data-testid="cf-preview-panel"]')))
    }

    syncPreviewPanel()

    const observer = new MutationObserver(syncPreviewPanel)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-testid', 'class'],
    })

    window.addEventListener('resize', syncPreviewPanel)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncPreviewPanel)
    }
  }, [])

  const panelStyle = {
    right: previewPanelOpen ? '25rem' : '2rem',
  }

  if (queue.length === 0) return null

  const activeCount = queue.filter((job) => job.status === 'pending' || job.status === 'transferring').length
  const failedCount = queue.filter((job) => job.status === 'failed').length
  const completedCount = queue.filter((job) => job.status === 'completed').length
  const totalBytes = queue.reduce((sum, job) => sum + (job.totalBytes || 0), 0)

  return (
    <div
      data-testid="cf-transfer-queue-panel"
      style={panelStyle}
      className={`fixed bottom-0 z-[1100] w-[23rem] rounded-t-[28px] border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)] shadow-[var(--cf-shadow-strong)] transition-all duration-300 ${isMinimized ? 'translate-y-[calc(100%-64px)]' : ''}`}
    >
      <div
        className="cursor-pointer rounded-t-[28px] border-b border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-5 py-4"
        onClick={() => setIsCollapsed(!isMinimized)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="cf-kicker">Transfer Queue</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--cf-text-0)]">Operational transfers</span>
              <span className="rounded-full border border-[var(--cf-border)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-2)]">
                {queue.length} total
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--cf-text-2)]">{formatBytes(totalBytes)} in queue scope</p>
          </div>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <button
                onClick={(event) => {
                  event.stopPropagation()
                  clearCompleted()
                }}
                className="rounded-xl border border-[var(--cf-border)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-text-2)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
              >
                Clear
              </button>
            )}
            <button className="rounded-xl border border-[var(--cf-border)] p-2 text-[var(--cf-text-2)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]">
              <svg className={`h-4 w-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.1)] px-3 py-2">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">Active</div>
            <div className="mt-1 text-lg font-semibold text-[var(--cf-blue)]">{activeCount}</div>
          </div>
          <div className="rounded-2xl border border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.1)] px-3 py-2">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">Completed</div>
            <div className="mt-1 text-lg font-semibold text-[var(--cf-green)]">{completedCount}</div>
          </div>
          <div className="rounded-2xl border border-[rgba(255,92,92,0.22)] bg-[rgba(255,92,92,0.08)] px-3 py-2">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--cf-text-2)]">Failed</div>
            <div className="mt-1 text-lg font-semibold text-[var(--cf-red)]">{failedCount}</div>
          </div>
        </div>
      </div>

      <div className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-4">
        {queue.map((job) => (
          <div
            key={job.id}
            data-testid={`cf-transfer-queue-item-${job.id}`}
            className="group rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-bg)] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${statusClass(job.status)}`}>
                    {statusLabel(job)}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--cf-text-3)]">
                    {job.type}
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-semibold text-[var(--cf-text-0)]" title={job.sourceFile.name}>
                  {job.sourceFile.name}
                </p>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--cf-text-2)]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--cf-blue)]" />
                    {providerName(job.sourceProvider)}
                  </span>
                  <span>→</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[var(--cf-teal)]" />
                    {providerName(job.targetProvider)}
                  </span>
                </div>
              </div>

              <button
                data-testid={`cf-transfer-queue-dismiss-${job.id}`}
                onClick={() => dismissTransfer(job.id)}
                className="rounded-xl p-2 text-[var(--cf-text-3)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="flex-1">
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-[var(--cf-bg3)]"
                  role="progressbar"
                  aria-valuenow={Math.max(0, Math.min(Math.round(job.progress), 100))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${job.sourceFile.name} transfer progress`}
                >
                  <div
                    className={`h-full transition-all duration-300 ${
                      job.status === 'failed'
                        ? 'bg-[var(--cf-red)]'
                        : job.status === 'completed'
                          ? 'bg-[var(--cf-green)]'
                          : 'bg-[var(--cf-blue)]'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(job.progress, 100))}%` }}
                  />
                </div>
              </div>
              <span
                className={`font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${
                  job.status === 'failed'
                    ? 'text-[var(--cf-red)]'
                    : job.status === 'completed'
                      ? 'text-[var(--cf-green)]'
                      : 'text-[var(--cf-blue)]'
                }`}
              >
                {job.status === 'transferring' ? `${Math.round(job.progress)}%` : job.status.toUpperCase()}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[var(--cf-text-2)]">
              <span className="font-mono">
                {formatBytes(job.bytesTransferred || 0)} / {formatBytes(job.totalBytes || 0)}
              </span>
              <span className="rounded-full border border-[var(--cf-border)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--cf-text-3)]">
                {job.targetPath || '/'}
              </span>
            </div>

            {job.status === 'failed' && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-[rgba(255,92,92,0.2)] bg-[rgba(255,92,92,0.08)] p-3">
                <p className="flex-1 truncate text-[11px] text-[var(--cf-red)]">{job.error || 'Unknown error'}</p>
                <button
                  data-testid={`cf-transfer-queue-retry-${job.id}`}
                  onClick={() => retryTransfer(job.id)}
                  className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--cf-red)] underline"
                >
                  Retry
                </button>
              </div>
            )}

            {job.status === 'completed' && (
              <div className="mt-3 rounded-2xl border border-[rgba(74,222,128,0.18)] bg-[rgba(74,222,128,0.08)] px-3 py-2 text-[11px] text-[var(--cf-text-1)]">
                Transferred {formatBytes(job.totalBytes)} successfully.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
