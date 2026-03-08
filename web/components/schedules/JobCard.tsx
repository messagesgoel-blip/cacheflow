'use client'

import { ScheduledJob } from '@/app/schedules/page'

interface JobCardProps {
  job: ScheduledJob
  jobTypeLabel: string
  jobTypeIcon: string
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}

function formatCronDescription(cron: string): string {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return cron

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  // Common patterns
  if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every hour'
  }
  if (minute === '0' && hour === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Daily at midnight'
  }
  if (minute === '0' && dayOfMonth === '*' && month === '*' && dayOfWeek === '0') {
    return `Weekly on Sunday at ${hour || 'midnight'}`
  }
  if (minute === '0' && dayOfMonth === '1' && month === '*' && dayOfWeek === '*') {
    return `Monthly on the 1st at ${hour || 'midnight'}`
  }
  if (minute !== '*' && hour !== '*') {
    return `At ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  }

  return cron
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function JobCard({
  job,
  jobTypeLabel,
  jobTypeIcon,
  onToggle,
  onEdit,
  onDelete,
}: JobCardProps) {
  return (
    <div
      data-testid={`cf-schedule-job-${job.id}`}
      className="group flex items-start justify-between gap-4 rounded-[22px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-3.5 transition hover:border-[rgba(255,255,255,0.16)] hover:bg-[rgba(255,255,255,0.05)]"
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(74,158,255,0.24)] bg-[rgba(74,158,255,0.12)] text-[var(--cf-blue)] shadow-[0_12px_28px_rgba(0,0,0,0.18)]">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={jobTypeIcon} />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--cf-text-0)]">
              {job.name}
            </h3>
            <span className="rounded-full border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] px-2 py-0.5 text-[10px] font-medium text-[var(--cf-text-2)]">
              {jobTypeLabel}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              job.enabled
                ? 'border-[rgba(74,222,128,0.22)] bg-[rgba(74,222,128,0.12)] text-[var(--cf-green)]'
                : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[var(--cf-text-2)]'
            }`}>
              {job.enabled ? 'Active' : 'Paused'}
            </span>
          </div>

          <div className="mt-2.5 grid gap-2 text-[11px] text-[var(--cf-text-2)] sm:grid-cols-3">
            <div className="rounded-[18px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.025)] px-3 py-2">
              <div className="cf-kicker mb-1 text-[9px]">Schedule</div>
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatCronDescription(job.cronExpression)}
              </span>
            </div>
            <div className="rounded-[18px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.025)] px-3 py-2">
              <div className="cf-kicker mb-1 text-[9px]">Next Run</div>
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDate(job.nextRunAt)}
              </span>
            </div>
            <div className="rounded-[18px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.025)] px-3 py-2">
              <div className="cf-kicker mb-1 text-[9px]">Last Run</div>
              <span className="flex items-center gap-1.5">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDate(job.lastRunAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="ml-2 flex shrink-0 items-center gap-1.5">
        <button
          onClick={onToggle}
          className={`rounded-xl border p-2 transition ${
            job.enabled
              ? 'border-[rgba(255,159,67,0.22)] text-[var(--cf-amber)] hover:bg-[rgba(255,159,67,0.1)]'
              : 'border-[rgba(74,222,128,0.22)] text-[var(--cf-green)] hover:bg-[rgba(74,222,128,0.1)]'
          }`}
          title={job.enabled ? 'Pause job' : 'Enable job'}
        >
          {job.enabled ? (
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </button>

        <button
          onClick={onEdit}
          className="rounded-xl border border-[var(--cf-border)] p-2 text-[var(--cf-text-2)] transition hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-blue)]"
          title="Edit job"
        >
          <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        <button
          onClick={onDelete}
          className="rounded-xl border border-[rgba(255,92,92,0.2)] p-2 text-[var(--cf-text-2)] transition hover:bg-[rgba(255,92,92,0.08)] hover:text-[var(--cf-red)]"
          title="Delete job"
        >
          <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}
