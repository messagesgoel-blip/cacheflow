'use client'

import { useMemo } from 'react'
import { useTransferContext, formatFileSize } from '@/context/TransferContext'

function statusClass(status: 'waiting' | 'active' | 'completed' | 'failed') {
  if (status === 'failed') {
    return 'border-[rgba(255,92,92,0.22)] bg-[rgba(255,92,92,0.1)] text-[var(--cf-red)]'
  }
  if (status === 'completed') {
    return 'border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.1)] text-[var(--cf-green)]'
  }
  if (status === 'active') {
    return 'border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.1)] text-[var(--cf-blue)]'
  }
  return 'border-[rgba(255,159,67,0.22)] bg-[rgba(255,159,67,0.1)] text-[var(--cf-amber)]'
}

function statusLabel(status: 'waiting' | 'active' | 'completed' | 'failed') {
  if (status === 'waiting') return 'Queued'
  if (status === 'active') return 'Active'
  if (status === 'completed') return 'Completed'
  return 'Failed'
}

export default function RecentTransfersPanel() {
  const { transfers } = useTransferContext()

  const items = useMemo(() => {
    return [...transfers].slice(0, 4)
  }, [transfers])

  const activeCount = transfers.filter((transfer) => transfer.status === 'active' || transfer.status === 'waiting').length
  const failedCount = transfers.filter((transfer) => transfer.status === 'failed').length
  const completedCount = transfers.filter((transfer) => transfer.status === 'completed').length

  return (
    <section data-testid="cf-dashboard-recent-transfers" className="cf-panel rounded-[28px] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="cf-kicker mb-2">Transfers</div>
          <h2 className="text-lg font-semibold text-[var(--cf-text-0)]">Recent transfer activity</h2>
          <p className="mt-1.5 text-sm text-[var(--cf-text-1)]">Live state from the current transfer context and tray feed.</p>
        </div>
        <div className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 text-[12px] text-[var(--cf-text-2)]">
          {transfers.length} total
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.08)] px-3 py-2.5">
          <div className="cf-kicker mb-1 text-[9px]">Active</div>
          <div className="text-lg font-semibold text-[var(--cf-blue)]">{activeCount}</div>
        </div>
        <div className="rounded-2xl border border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.08)] px-3 py-2.5">
          <div className="cf-kicker mb-1 text-[9px]">Completed</div>
          <div className="text-lg font-semibold text-[var(--cf-green)]">{completedCount}</div>
        </div>
        <div className="rounded-2xl border border-[rgba(255,92,92,0.22)] bg-[rgba(255,92,92,0.08)] px-3 py-2.5">
          <div className="cf-kicker mb-1 text-[9px]">Failed</div>
          <div className="text-lg font-semibold text-[var(--cf-red)]">{failedCount}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-8 text-center text-sm text-[var(--cf-text-2)]">
          No transfer activity has been recorded in this session yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((transfer) => (
            <div
              key={transfer.jobId}
              data-testid={`cf-dashboard-transfer-${transfer.jobId}`}
              className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--cf-text-0)]">{transfer.fileName}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusClass(transfer.status)}`}>
                      {statusLabel(transfer.status)}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--cf-text-2)]">
                    {transfer.sourceProvider || 'Source'} → {transfer.destProvider || 'Destination'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-[var(--cf-text-0)]">{transfer.progress}%</div>
                  <div className="text-[11px] text-[var(--cf-text-2)]">{formatFileSize(transfer.fileSize || 0)}</div>
                </div>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--cf-bg3)]">
                <div
                  className={`h-full ${
                    transfer.status === 'failed'
                      ? 'bg-[var(--cf-red)]'
                      : transfer.status === 'completed'
                        ? 'bg-[var(--cf-green)]'
                        : 'bg-[var(--cf-blue)]'
                  }`}
                  style={{ width: `${Math.min(transfer.progress, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
