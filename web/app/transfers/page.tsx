'use client'

import { useState, useEffect } from 'react'
import { ArrowLeftRight, RotateCcw, XCircle, Download, Upload, Move, Copy, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { useTransferContext, TransferItem as TransferItemType } from '@/context/TransferContext'

export default function TransfersPage() {
  const { transfers, retryTransfer, dismissTransfer, refreshTransfers } = useTransferContext()
  const [loading, setLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    refreshTransfers()
  }, [refreshTransfers])

  async function handleRetry(jobId: string) {
    setProcessingId(jobId)
    try {
      await retryTransfer(jobId)
    } catch (err) {
      console.error(err)
      alert('Failed to retry transfer')
    } finally {
      setProcessingId(null)
    }
  }

  function handleDismiss(jobId: string) {
    dismissTransfer(jobId)
  }

  function formatSize(bytes: number) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  function getOperationIcon(operation?: string) {
    switch (operation) {
      case 'upload': return <Upload size={16} className="text-blue-500" />
      case 'download': return <Download size={16} className="text-green-500" />
      case 'move': return <Move size={16} className="text-purple-500" />
      case 'copy': return <Copy size={16} className="text-orange-500" />
      case 'delete': return <Trash2 size={16} className="text-red-500" />
      default: return <ArrowLeftRight size={16} className="text-gray-500" />
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Completed</span>
      case 'failed':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Failed</span>
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Active</span>
      case 'waiting':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Waiting</span>
      default:
        return null
    }
  }

  const activeTransfers = transfers.filter(t => t.status === 'active' || t.status === 'waiting')
  const completedTransfers = transfers.filter(t => t.status === 'completed' || t.status === 'failed')

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowLeftRight className="text-blue-500" />
            Transfers
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            View and manage your file transfers.
          </p>
        </div>

        <button
          onClick={() => refreshTransfers()}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading && transfers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-500">Loading transfers...</p>
        </div>
      ) : transfers.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <EmptyState
            data-testid="transfers-empty-state"
            icon={<ArrowLeftRight size={40} className="text-gray-400" />}
            title="No transfers"
            description="Transfer activity will appear here once a copy or move starts."
          />
        </div>
      ) : (
        <>
          {/* Active Transfers */}
          {activeTransfers.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Active Transfers ({activeTransfers.length})
              </h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm font-medium">
                      <th className="px-6 py-4">File</th>
                      <th className="px-6 py-4">Operation</th>
                      <th className="px-6 py-4">Progress</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {activeTransfers.map((transfer) => (
                      <tr key={transfer.jobId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
                            {transfer.fileName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {transfer.sourceProvider} → {transfer.destProvider}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getOperationIcon(transfer.operation)}
                            <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">{transfer.operation}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-32">
                            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                              <div
                                className="h-2 rounded-full bg-blue-500 transition-all"
                                style={{ width: `${transfer.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{transfer.progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(transfer.status)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 text-right font-mono">
                          {formatSize(transfer.fileSize)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Completed Transfers */}
          {completedTransfers.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Completed ({completedTransfers.filter(t => t.status === 'completed').length}) / Failed ({completedTransfers.filter(t => t.status === 'failed').length})
              </h2>
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm font-medium">
                      <th className="px-6 py-4">File</th>
                      <th className="px-6 py-4">Operation</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Error</th>
                      <th className="px-6 py-4 text-right">Size</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {completedTransfers.map((transfer) => (
                      <tr key={transfer.jobId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
                            {transfer.fileName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {transfer.sourceProvider} → {transfer.destProvider}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getOperationIcon(transfer.operation)}
                            <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">{transfer.operation}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(transfer.status)}
                        </td>
                        <td className="px-6 py-4">
                          {transfer.error && (
                            <span className="text-xs text-red-600 dark:text-red-400 max-w-xs truncate block">
                              {transfer.error}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 text-right font-mono">
                          {formatSize(transfer.fileSize)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {transfer.status === 'failed' && (
                              <button
                                onClick={() => handleRetry(transfer.jobId)}
                                disabled={!!processingId}
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title="Retry"
                              >
                                <RotateCcw size={16} className={processingId === transfer.jobId ? 'animate-spin' : ''} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDismiss(transfer.jobId)}
                              className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                              title="Dismiss"
                            >
                              <XCircle size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}