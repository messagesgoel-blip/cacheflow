'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import JobCard from '@/components/schedules/JobCard'
import CreateJobModal from '@/components/schedules/CreateJobModal'

export interface ScheduledJob {
  id: string
  name: string
  jobType: string
  cronExpression: string
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
  updatedAt: string
}

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
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null)

  useEffect(() => {
    const t = localStorage.getItem('cf_token')
    const e = localStorage.getItem('cf_email')

    if (!t) {
      router.push('/')
      return
    }

    setToken(t)
    setEmail(e || '')
  }, [router])

  const fetchJobs = useCallback(async (t: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/jobs', {
        headers: { Authorization: `Bearer ${t}` },
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
    if (token) {
      fetchJobs(token)
    }
  }, [token, fetchJobs])

  const handleCreateJob = async (jobData: {
    name: string
    jobType: string
    cronExpression: string
    enabled: boolean
  }) => {
    if (!token) return

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
    if (!token) return

    try {
      const res = await fetch(`/api/jobs?id=${jobId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
    if (!token) return

    if (!confirm('Are you sure you want to delete this scheduled job?')) {
      return
    }

    try {
      const res = await fetch(`/api/jobs?id=${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
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

  const handleLogout = () => {
    localStorage.removeItem('cf_token')
    localStorage.removeItem('cf_email')
    router.push('/')
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar email={email} onLogout={handleLogout} />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
          <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Scheduled Jobs</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Manage automated backup, sync, and maintenance tasks
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Job
            </button>
          </div>

          {error && (
            <div className="mx-6 mt-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="p-6">
            {loading ? (
              <div className="text-center py-12 text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2">Loading scheduled jobs...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400 mb-4">No scheduled jobs yet</p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
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
