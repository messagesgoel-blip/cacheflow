'use client'

import { useState, useEffect, useCallback } from 'react'
import MissionControl from '@/components/MissionControl'
import JobCard from '@/components/schedules/JobCard'
import CreateJobModal from '@/components/schedules/CreateJobModal'
import ScheduleTransferSnapshot from '@/components/schedules/ScheduleTransferSnapshot'
import type { ScheduledJob } from '@/lib/jobs/types'
import { useClientSession } from '@/lib/auth/clientSession'

const JOB_TYPE_LABELS: Record<string, string> = {
  'sync-file': 'File Sync',
  'backup-data': 'Backup',
  'cleanup-temp-files': 'Cleanup',
  'refresh-token': 'Token Refresh',
}

const JOB_TYPE_ICONS: Record<string, string> = {
  'sync-file': 'M4 16v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M4 8V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M4 8h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z',
  'backup-data': 'M5 8h14M5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8z M12 3v4m0 10v4M3 12h4m10 0h4',
  'cleanup-temp-files': 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  'refresh-token': 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
}

export default function SchedulesPage() {
  const { authenticated, email, loading: sessionLoading } = useClientSession({ redirectTo: '/login?reason=session_expired' })
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs', {
        credentials: 'include',
        cache: 'no-store',
      })
      const data = await res.json()
      if (Array.isArray(data)) {
        setJobs(data)
      } else if (data.error) {
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to load scheduled jobs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authenticated) {
      fetchJobs()
    }
  }, [authenticated, fetchJobs])

  useEffect(() => {
    const syncComposeState = () => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('compose') === 'new') {
        setEditingJob(null)
        setIsModalOpen(true)
      }
    }

    syncComposeState()
    window.addEventListener('popstate', syncComposeState)

    return () => {
      window.removeEventListener('popstate', syncComposeState)
    }
  }, [])

  const handleCreateJob = async (jobData: {
    name: string
    jobType: string
    cronExpression: string
    enabled: boolean
  }) => {
    if (!authenticated) return

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(jobData),
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      setJobs(prev => [...prev, data])
      setIsModalOpen(false)
    } catch (err) {
      setError('Failed to create job')
    }
  }

  const handleUpdateJob = async (jobId: string, updates: Partial<ScheduledJob>) => {
    if (!authenticated) return

    try {
      const res = await fetch(`/api/jobs?id=${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(updates),
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      setJobs(prev => prev.map(j => j.id === jobId ? data : j))
      setEditingJob(null)
    } catch (err) {
      setError('Failed to update job')
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    if (!authenticated) return

    if (!confirm('Are you sure you want to delete this scheduled job?')) {
      return
    }

    try {
      const res = await fetch(`/api/jobs?id=${jobId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        return
      }

      setJobs(prev => prev.filter(j => j.id !== jobId))
    } catch (err) {
      setError('Failed to delete job')
    }
  }

  const handleToggleJob = (job: ScheduledJob) => {
    handleUpdateJob(job.id, { enabled: !job.enabled })
  }

  const handleEditJob = (job: ScheduledJob) => {
    setEditingJob(job)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingJob(null)
  }

  const activeJobs = jobs.filter((job) => job.enabled).length
  const pausedJobs = jobs.filter((job) => !job.enabled).length
  const upcomingJobs = jobs.filter((job) => Boolean(job.nextRunAt)).length

  if (sessionLoading || !authenticated) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--cf-blue)]" />
          <p className="mt-2 text-[var(--cf-text-1)]">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      

      <main data-testid="cf-schedules-page" className="mx-auto max-w-[1600px] px-4 py-6 md:px-6">
        <MissionControl />
        
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="cf-kicker mb-2">Schedules</div>
            <h1 className="text-[28px] font-semibold leading-tight text-[var(--cf-text-0)]">Scheduled Jobs</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--cf-text-1)]">
              Manage automated backup, sync, cleanup, and token-refresh tasks with the current control plane job API.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl border border-[rgba(74,158,255,0.28)] bg-[rgba(74,158,255,0.14)] px-4 py-2.5 text-sm font-medium text-[var(--cf-blue)] transition hover:bg-[rgba(74,158,255,0.2)]"
          >
            New Job
          </button>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="cf-panel rounded-[24px] p-4">
            <div className="cf-kicker mb-2">Active Jobs</div>
            <div className="font-mono text-[28px] font-bold text-[var(--cf-blue)]">{activeJobs}</div>
            <p className="mt-1.5 text-sm text-[var(--cf-text-2)]">Schedules currently enabled and ready to execute.</p>
          </div>
          <div className="cf-panel rounded-[24px] p-4">
            <div className="cf-kicker mb-2">Paused Jobs</div>
            <div className="font-mono text-[28px] font-bold text-[var(--cf-amber)]">{pausedJobs}</div>
            <p className="mt-1.5 text-sm text-[var(--cf-text-2)]">Schedules retained in the system but not currently running.</p>
          </div>
          <div className="cf-panel rounded-[24px] p-4">
            <div className="cf-kicker mb-2">Upcoming Runs</div>
            <div className="font-mono text-[28px] font-bold text-[var(--cf-teal)]">{upcomingJobs}</div>
            <p className="mt-1.5 text-sm text-[var(--cf-text-2)]">Jobs with a next scheduled execution already computed.</p>
          </div>
        </div>

        <div className="mb-6">
          <ScheduleTransferSnapshot />
        </div>

        <div className="cf-panel rounded-[30px] overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--cf-border)] px-5 py-4 sm:px-6">
            <div>
              <div className="cf-kicker mb-2">Queue</div>
              <h2 className="text-lg font-semibold text-[var(--cf-text-0)]">Automation registry</h2>
              <p className="mt-1 text-sm text-[var(--cf-text-2)]">
                Review cadence, last execution, and current job state in one place.
              </p>
            </div>
            <div className="rounded-full border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-1.5 text-[12px] text-[var(--cf-text-2)]">
              {jobs.length} total job{jobs.length === 1 ? '' : 's'}
            </div>
          </div>

          {error && (
            <div className="mx-6 mt-4 rounded-2xl border border-[rgba(255,92,92,0.2)] bg-[rgba(255,92,92,0.08)] p-4 text-sm text-[var(--cf-red)]">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="p-5 sm:p-6">
            {loading ? (
              <div className="py-14 text-center text-[var(--cf-text-2)]">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--cf-blue)]" />
                <p className="mt-2">Loading scheduled jobs...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="rounded-[28px] border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] py-14 text-center">
                <svg className="mx-auto mb-4 h-12 w-12 text-[var(--cf-text-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="mb-4 text-[var(--cf-text-1)]">No scheduled jobs yet</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="text-sm text-[var(--cf-blue)] hover:underline"
                >
                  Create your first scheduled job →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    jobTypeLabel={JOB_TYPE_LABELS[job.jobType] || job.jobType}
                    jobTypeIcon={JOB_TYPE_ICONS[job.jobType] || JOB_TYPE_ICONS['sync-file']}
                    onToggle={() => handleToggleJob(job)}
                    onEdit={() => handleEditJob(job)}
                    onDelete={() => handleDeleteJob(job.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {isModalOpen && (
        <CreateJobModal
          job={editingJob}
          onSave={editingJob
            ? (data) => handleUpdateJob(editingJob.id, data)
            : handleCreateJob
          }
          onClose={closeModal}
        />
      )}
    </div>
  )
}
