'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useTransferContext, formatFileSize } from '@/context/TransferContext'

function statusClass(status: 'waiting' | 'active' | 'completed' | 'failed') {
  if (status === 'failed') {
    return 'border-[rgba(255,92,92,0.22)] bg-[rgba(255,92,92,0.08)] text-[var(--cf-red)]'
  }
  if (status === 'completed') {
    return 'border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.08)] text-[var(--cf-green)]'
  }
  if (status === 'active') {
    return 'border-[rgba(74,158,255,0.22)] bg-[rgba(74,158,255,0.08)] text-[var(--cf-blue)]'
  }
  return 'border-[rgba(255,159,67,0.22)] bg-[rgba(255,159,67,0.08)] text-[var(--cf-amber)]'
}

function statusLabel(status: 'waiting' | 'active' | 'completed' | 'failed') {
  if (status === 'waiting') return 'Queued'
  if (status === 'active') return 'Active'
  if (status === 'completed') return 'Completed'
  return 'Failed'
}

export default function ScheduleTransferSnapshot() {
  const { transfers } = useTransferContext()

  const items = useMemo(() => [...transfers].slice(0, 3), [transfers])
  const activeCount = transfers.filter((transfer) => transfer.status === 'active' || transfer.status === 'waiting').length
  const completedCount = transfers.filter((transfer) => transfer.status === 'completed').length
  const failedCount = transfers.filter((transfer) => transfer.status === 'failed').length

  return (
    <section data-testid="cf-schedules-transfer-snapshot" className="cf-panel rounded-[30px] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="cf-kicker mb-2">Transfers</div>
          <h2 className="text-lg font-semibold text-[var(--cf-text-0)]">Recent queue snapshot</h2>
          <p className="mt-1.5 text-sm text-[var(--cf-text-1)]">
            Keep schedules aligned with the current transfer queue without introducing a new backend surface.
          </p>
        </div>
        <Link
          href="/files"
          className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 text-[12px] text-[var(--cf-text-1)] transition hover:border-[rgba(255,255,255,0.16)] hover:text-[var(--cf-text-0)]"
        >
          Open files
        </Link>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
          <div className="cf-kicker mb-2">Active</div>
          <div className="font-mono text-[24px] font-bold text-[var(--cf-blue)]">{activeCount}</div>
        </div>
        <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
          <div className="cf-kicker mb-2">Completed</div>
          <div className="font-mono text-[24px] font-bold text-[var(--cf-green)]">{completedCount}</div>
        </div>
        <div className="rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-4">
          <div className="cf-kicker mb-2">Failed</div>
          <div className="font-mono text-[24px] font-bold text-[var(--cf-red)]">{failedCount}</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[24px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-4 py-6 text-sm text-[var(--cf-text-2)]">
          No transfer history is currently loaded into this session.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((transfer) => (
            <div
              key={transfer.jobId}
              data-testid={`cf-schedules-transfer-${transfer.jobId}`}
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
                  <p className="mt-1 text-[12px] text-[var(--cf-text-2)]">
                    {transfer.sourceProvider || 'Source'} → {transfer.destProvider || 'Destination'}
                  </p>
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
