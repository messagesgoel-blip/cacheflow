'use client'

import { useState } from 'react'
import { useTransferQueue } from './TransferQueueProvider'
import { PROVIDERS, formatBytes } from '@/lib/providers/types'

export default function TransferQueuePanel() {
  const { queue, retryTransfer, dismissTransfer, clearCompleted } = useTransferQueue()
  const [isMinimized, setIsCollapsed] = useState(false)

  if (queue.length === 0) return null

  const activeCount = queue.filter(j => j.status === 'pending' || j.status === 'transferring').length
  const failedCount = queue.filter(j => j.status === 'failed').length
  const completedCount = queue.filter(j => j.status === 'completed').length

  return (
    <div 
      data-testid="cf-transfer-queue-panel"
      className={`fixed bottom-0 right-8 z-[1100] w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl rounded-t-xl transition-all duration-300 ${isMinimized ? 'translate-y-[calc(100%-48px)]' : ''}`}
    >
      {/* Header */}
      <div 
        className="px-4 py-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between cursor-pointer rounded-t-xl"
        onClick={() => setIsCollapsed(!isMinimized)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            Transfers ({queue.length})
          </span>
          {activeCount > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-blue-600 font-medium">{activeCount} active</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {completedCount > 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); clearCompleted() }}
              className="p-1 text-[10px] text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
          <button className="p-1 text-gray-500 hover:text-gray-700">
            <svg className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {queue.map((job) => (
          <div key={job.id} data-testid={`cf-transfer-queue-item-${job.id}`} className="p-4 space-y-2 group">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate" title={job.sourceFile.name}>
                  {job.sourceFile.name}
                </p>
                <p className="text-[10px] text-gray-500 truncate uppercase tracking-tighter">
                  {PROVIDERS.find(p => p.id === job.sourceProvider)?.name} → {PROVIDERS.find(p => p.id === job.targetProvider)?.name}
                </p>
              </div>
              <button 
                data-testid={`cf-transfer-queue-dismiss-${job.id}`}
                onClick={() => dismissTransfer(job.id)}
                className="p-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress / Status */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      job.status === 'failed' ? 'bg-red-500' : 
                      job.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
              </div>
              <span className={`text-[10px] font-bold ${
                job.status === 'failed' ? 'text-red-600' : 
                job.status === 'completed' ? 'text-green-600' : 'text-blue-600'
              }`}>
                {job.status === 'transferring' ? `${job.progress}%` : job.status.toUpperCase()}
              </span>
            </div>

            {job.status === 'failed' && (
              <div className="flex items-center justify-between gap-2 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
                <p className="text-[10px] text-red-700 dark:text-red-300 truncate flex-1">{job.error || 'Unknown error'}</p>
                <button 
                  data-testid={`cf-transfer-queue-retry-${job.id}`}
                  onClick={() => retryTransfer(job.id)}
                  className="text-[10px] font-bold text-red-700 dark:text-red-300 underline"
                >
                  Retry
                </button>
              </div>
            )}

            {job.status === 'completed' && (
              <p className="text-[10px] text-gray-400 italic">
                Transferred {formatBytes(job.totalBytes)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
