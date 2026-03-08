'use client'

import { useState, useEffect } from 'react'
import { ScheduledJob } from '@/app/schedules/page'

const THROTTLE_PRESETS = [
  { value: null, label: 'Unlimited', description: 'No bandwidth limit' },
  { value: 1 * 1024 * 1024, label: '1 MB/s', description: 'Low impact' },
  { value: 5 * 1024 * 1024, label: '5 MB/s', description: 'Moderate' },
  { value: 25 * 1024 * 1024, label: '25 MB/s', description: 'Standard' },
  { value: 100 * 1024 * 1024, label: '100 MB/s', description: 'High throughput' },
]

interface CreateJobModalProps {
  job: ScheduledJob | null
  onSave: (data: {
    name: string
    jobType: string
    cronExpression: string
    enabled: boolean
    throttle?: { maxBytesPerSecond: number | null }
  }) => void
  onClose: () => void
}

const JOB_TYPES = [
  { value: 'sync-file', label: 'File Sync', description: 'Sync files between providers' },
  { value: 'backup-data', label: 'Backup', description: 'Backup data to storage' },
  { value: 'cleanup-temp-files', label: 'Cleanup', description: 'Clean up temporary files' },
  { value: 'refresh-token', label: 'Token Refresh', description: 'Refresh authentication tokens' },
]

const CRON_PRESETS = [
  { value: '0 * * * *', label: 'Every hour', description: 'At minute 0 of every hour' },
  { value: '0 0 * * *', label: 'Daily', description: 'Every day at midnight' },
  { value: '0 2 * * *', label: 'Daily at 2 AM', description: 'Every day at 2:00 AM' },
  { value: '0 0 * * 0', label: 'Weekly', description: 'Every Sunday at midnight' },
  { value: '0 0 1 * *', label: 'Monthly', description: 'First day of every month' },
]

export default function CreateJobModal({ job, onSave, onClose }: CreateJobModalProps) {
  const [name, setName] = useState('')
  const [jobType, setJobType] = useState('sync-file')
  const [cronExpression, setCronExpression] = useState('0 0 * * *')
  const [enabled, setEnabled] = useState(true)
  const [throttle, setThrottle] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCustomCron, setShowCustomCron] = useState(false)

  useEffect(() => {
    if (job) {
      setName(job.name)
      setJobType(job.jobType)
      setCronExpression(job.cronExpression)
      setEnabled(job.enabled)
      // Check if it's a custom cron
      const isPreset = CRON_PRESETS.some(p => p.value === job.cronExpression)
      setShowCustomCron(!isPreset)
    }
  }, [job])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Job name is required')
      return
    }

    if (!cronExpression.trim()) {
      setError('Cron expression is required')
      return
    }

    // Basic cron validation
    const cronParts = cronExpression.trim().split(/\s+/)
    if (cronParts.length !== 5) {
      setError('Invalid cron expression format (expected 5 fields)')
      return
    }

    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        jobType,
        cronExpression: cronExpression.trim(),
        enabled,
        throttle: { maxBytesPerSecond: throttle },
      })
    } catch (err) {
      setError('Failed to save job')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,8,12,0.72)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[var(--cf-border)] bg-[var(--cf-shell-card-strong)] p-5 shadow-[0_36px_90px_rgba(0,0,0,0.42)] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <div className="cf-kicker mb-2">Schedules</div>
            <h2 className="text-xl font-semibold text-[var(--cf-text-0)]">
              {job ? 'Edit Job' : 'Create Scheduled Job'}
            </h2>
            <p className="mt-1.5 text-sm text-[var(--cf-text-1)]">
              Configure cadence and execution state without leaving the current registry view.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-[var(--cf-border)] p-2 text-[var(--cf-text-2)] transition hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-2xl border border-[rgba(255,92,92,0.2)] bg-[rgba(255,92,92,0.08)] px-4 py-3 text-sm text-[var(--cf-red)]">
              {error}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--cf-text-1)]">
                  Job Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Daily Backup"
                  className="w-full rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-2.5 text-[var(--cf-text-0)] placeholder:text-[var(--cf-text-3)] focus:border-[var(--cf-blue)] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--cf-text-1)]">
                  Job Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {JOB_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setJobType(type.value)}
                      className={`rounded-[18px] border p-3 text-left transition ${
                        jobType === type.value
                          ? 'border-[rgba(74,158,255,0.3)] bg-[rgba(74,158,255,0.12)]'
                          : 'border-[var(--cf-border)] bg-[rgba(255,255,255,0.025)] hover:border-[rgba(255,255,255,0.14)]'
                      }`}
                    >
                      <div className="text-sm font-medium text-[var(--cf-text-0)]">
                        {type.label}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--cf-text-2)]">
                        {type.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.025)] p-4">
              <div className="cf-kicker mb-2">Execution</div>
              <h3 className="text-sm font-semibold text-[var(--cf-text-0)]">Schedule</h3>
              {!showCustomCron ? (
                <div className="mt-3 space-y-2">
                  {CRON_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setCronExpression(preset.value)}
                      className={`w-full rounded-[18px] border p-3 text-left transition ${
                        cronExpression === preset.value
                          ? 'border-[rgba(74,158,255,0.3)] bg-[rgba(74,158,255,0.12)]'
                          : 'border-[var(--cf-border)] bg-[rgba(255,255,255,0.025)] hover:border-[rgba(255,255,255,0.14)]'
                      }`}
                    >
                      <div className="text-sm font-medium text-[var(--cf-text-0)]">
                        {preset.label}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[var(--cf-text-2)]">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowCustomCron(true)}
                    className="pt-1 text-sm text-[var(--cf-blue)] hover:underline"
                  >
                    Use custom cron expression →
                  </button>
                </div>
              ) : (
                <div className="mt-3">
                  <input
                    type="text"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="0 0 * * *"
                    className="w-full rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-2.5 font-mono text-[var(--cf-text-0)] placeholder:text-[var(--cf-text-3)] focus:border-[var(--cf-blue)] focus:outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-[var(--cf-text-2)]">
                      Format: minute hour day month weekday
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCustomCron(false)}
                      className="text-sm text-[var(--cf-blue)] hover:underline"
                    >
                      ← Choose preset
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-[18px] border border-[var(--cf-border)] bg-[rgba(255,255,255,0.025)] px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[var(--cf-text-0)]">Enable job immediately</div>
                    <div className="text-[11px] text-[var(--cf-text-2)]">The new schedule starts running as soon as it is saved.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      enabled ? 'bg-[var(--cf-blue)]' : 'bg-[var(--cf-bg3)]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bandwidth Throttle */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--cf-text-1)]">
              Bandwidth Throttle
            </label>
            <div className="grid grid-cols-5 gap-2">
              {THROTTLE_PRESETS.map((preset) => (
                <button
                  key={String(preset.value)}
                  type="button"
                  onClick={() => setThrottle(preset.value)}
                  className={`rounded-[14px] border p-2 text-center transition ${
                    throttle === preset.value
                      ? 'border-[rgba(74,158,255,0.3)] bg-[rgba(74,158,255,0.12)]'
                      : 'border-[var(--cf-border)] bg-[rgba(255,255,255,0.025)] hover:border-[rgba(255,255,255,0.14)]'
                  }`}
                >
                  <div className="text-xs font-medium text-[var(--cf-text-0)]">{preset.label}</div>
                  <div className="mt-0.5 text-[9px] text-[var(--cf-text-2)]">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[var(--cf-border)] px-4 py-2.5 font-medium text-[var(--cf-text-1)] transition hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl border border-[rgba(74,158,255,0.28)] bg-[rgba(74,158,255,0.14)] px-4 py-2.5 font-medium text-[var(--cf-blue)] transition hover:bg-[rgba(74,158,255,0.2)] disabled:opacity-50"
            >
              {saving ? 'Saving...' : job ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
