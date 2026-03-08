'use client'

import { useState, useEffect } from 'react'
import { ScheduledJob } from '@/app/schedules/page'

interface CreateJobModalProps {
  job: ScheduledJob | null
  onSave: (data: {
    name: string
    jobType: string
    cronExpression: string
    enabled: boolean
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
      })
    } catch (err) {
      setError('Failed to save job')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {job ? 'Edit Job' : 'Create Scheduled Job'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Job Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Backup"
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Job Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {JOB_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setJobType(type.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    jobType === type.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    {type.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Schedule
            </label>
            {!showCustomCron ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {CRON_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setCronExpression(preset.value)}
                      className={`p-2.5 rounded-lg border text-left transition-colors ${
                        cronExpression === preset.value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-white">
                        {preset.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomCron(true)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Use custom cron expression →
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 0 * * *"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Format: minute hour day month weekday
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCustomCron(false)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    ← Choose preset
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Enable job immediately
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 font-medium transition-colors"
            >
              {saving ? 'Saving...' : job ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

