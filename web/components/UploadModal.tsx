'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { ProviderId, ProviderQuota, PROVIDERS, formatBytes } from '@/lib/providers/types'
import { tokenManager } from '@/lib/tokenManager'
import { getProvider } from '@/lib/providers'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ConnectedProviderInfo {
  providerId: ProviderId
  quota?: ProviderQuota
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const [files, setFiles] = useState<File[]>([])
  const [targetProvider, setTargetProvider] = useState<ProviderId | 'auto'>('auto')
  const [targetPath, setTargetPath] = useState('/')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const [dragOver, setDragOver] = useState(false)
  const [connectedProviders, setConnectedProviders] = useState<ConnectedProviderInfo[]>([])
  const [loadingQuotas, setLoadingQuotas] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load connected providers and their quotas
  useEffect(() => {
    async function loadProviders() {
      const providerIds: ProviderId[] = ['google', 'onedrive', 'dropbox', 'box', 'pcloud', 'filen', 'yandex']
      const connected: ConnectedProviderInfo[] = []
      setLoadingQuotas(true)

      for (const pid of providerIds) {
        const token = tokenManager.getToken(pid)
        if (token && token.accessToken) {
          let quota: ProviderQuota | undefined
          try {
            const provider = getProvider(pid)
            if (provider) {
              quota = await provider.getQuota()
            }
          } catch (err) {
            console.error(`Failed to get quota for ${pid}:`, err)
          }
          connected.push({ providerId: pid, quota })
        }
      }

      setConnectedProviders(connected)
      setLoadingQuotas(false)
    }

    if (isOpen) {
      loadProviders()
    }
  }, [isOpen])

  const providerQuotas = connectedProviders.reduce((acc, cp) => {
    acc[cp.providerId] = cp.quota
    return acc
  }, {} as Record<ProviderId, ProviderQuota | undefined>)

  // Auto-select provider with most free space
  const autoSelectProvider = useCallback((): ProviderId => {
    let bestProvider: ProviderId = 'google'
    let maxFree = 0

    connectedProviders.forEach(cp => {
      const free = cp.quota?.free ?? 0
      if (free > maxFree) {
        maxFree = free
        bestProvider = cp.providerId
      }
    })

    return bestProvider
  }, [connectedProviders])

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files || [])])
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
    }
  }

  // Remove file from queue
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Clear all files
  const clearFiles = () => {
    setFiles([])
    setUploadProgress({})
  }

  // Calculate total size
  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  // Handle upload (placeholder)
  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)

    // Simulate upload progress
    const provider = targetProvider === 'auto' ? autoSelectProvider() : targetProvider

    files.forEach((file, index) => {
      const fileId = `upload-${index}`
      let progress = 0

      const interval = setInterval(() => {
        progress += Math.random() * 20
        if (progress >= 100) {
          progress = 100
          clearInterval(interval)
        }
        setUploadProgress(prev => ({ ...prev, [fileId]: progress }))
      }, 200)
    })

    // TODO: Implement actual upload
    // onUpload(files, provider, targetPath)

    // Show success after "upload"
    setTimeout(() => {
      setUploading(false)
      alert(`Upload ${files.length} file(s) to ${PROVIDERS.find(p => p.id === provider)?.name}: Not yet implemented`)
      onClose()
      clearFiles()
    }, 3000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Upload Files
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-6 ${
            dragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-400'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="text-4xl mb-3">📁</div>
          <p className="text-gray-700 dark:text-gray-300 font-medium">
            Drop files here or click to browse
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            You can select multiple files
          </p>
        </div>

        {/* Selected Files */}
        {files.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900 dark:text-white">
                Selected Files ({files.length})
              </h3>
              <button
                onClick={clearFiles}
                className="text-sm text-red-500 hover:underline"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl">📄</span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {uploading && (
                      <div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${uploadProgress[`upload-${index}`] || 0}%` }}
                        />
                      </div>
                    )}
                    <button
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                      className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 text-right text-sm text-gray-500 dark:text-gray-400">
              Total: {formatBytes(totalSize)}
            </div>
          </div>
        )}

        {/* Target Provider */}
        {files.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Upload to
            </label>

            <div className="grid grid-cols-1 gap-2">
              {/* Auto-select option */}
              <label
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                  targetProvider === 'auto'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="targetProvider"
                    value="auto"
                    checked={targetProvider === 'auto'}
                    onChange={() => setTargetProvider('auto')}
                    className="text-blue-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Auto-select provider
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Upload to the provider with most free space
                    </p>
                  </div>
                </div>
                <span className="text-2xl">🎯</span>
              </label>

              {/* Individual providers */}
              {connectedProviders.map(cp => {
                const provider = PROVIDERS.find(p => p.id === cp.providerId)
                if (!provider) console.warn(`No provider config found for: ${cp.providerId}`)
                const quota = cp.quota

                return (
                  <label
                    key={cp.providerId}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      targetProvider === cp.providerId
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="radio"
                        name="targetProvider"
                        value={cp.providerId}
                        checked={targetProvider === cp.providerId}
                        onChange={() => setTargetProvider(cp.providerId)}
                        className="text-blue-500"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: provider?.color }}
                          />
                          <p className="font-medium text-gray-900 dark:text-white">
                            {provider?.name}
                          </p>
                        </div>
                        {quota && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {quota.freeDisplay} free ({quota.percentUsed.toFixed(0)}% used)
                          </p>
                        )}
                      </div>
                    </div>
                    <span>{provider?.icon || '📁'}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Target Path */}
        {files.length > 0 && connectedProviders.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Destination folder
            </label>
            <input
              type="text"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="/"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload {files.length > 0 && `(${files.length})`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Upload Button Component (to use in other pages)
interface UploadButtonProps {
  onClick: () => void
  className?: string
}

export function UploadButton({ onClick, className = '' }: UploadButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors ${className}`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      Upload
    </button>
  )
}
