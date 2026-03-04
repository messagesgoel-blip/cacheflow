'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Conflict Resolution Modal
 *
 * A shared modal component for resolving file conflicts during transfers.
 * Displays conflict details (local vs remote version) and allows users to
 * choose how to resolve each conflict: keep local, keep remote, or keep both (rename).
 *
 * Used by: upload, copy, move, and sync operations
 *
 * Gate: TRANSFER-1
 */

export interface FileVersion {
  path: string
  sizeBytes: number
  modifiedAt: string
  provider?: string
}

export interface Conflict {
  id: string
  fileName: string
  operation: 'upload' | 'copy' | 'move' | 'sync'
  sourcePath?: string
  targetPath: string
  localVersion?: FileVersion
  remoteVersion?: FileVersion
  detectedAt: string
}

export type Resolution = 'keep_local' | 'keep_remote' | 'keep_both' | 'skip'

export interface ConflictResolution {
  conflictId: string
  resolution: Resolution
  newFileName?: string // Only used when resolution is 'keep_both'
}

export interface ConflictResolutionModalProps {
  isOpen: boolean
  conflicts: Conflict[]
  onResolve: (resolutions: ConflictResolution[]) => void
  onClose: () => void
  title?: string
  description?: string
}

export default function ConflictResolutionModal({
  isOpen,
  conflicts,
  onResolve,
  onClose,
  title = 'File Conflict Detected',
  description = 'A file with the same name already exists at the destination. Choose how to resolve this conflict:',
}: ConflictResolutionModalProps) {
  const [resolutions, setResolutions] = useState<Map<string, Resolution>>(new Map())
  const [newFileNames, setNewFileNames] = useState<Map<string, string>>(new Map())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isResolving, setIsResolving] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setResolutions(new Map())
      setNewFileNames(new Map())
      setCurrentIndex(0)
      setIsResolving(false)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isResolving) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, isResolving, onClose])

  const currentConflict = conflicts[currentIndex]

  const handleResolution = useCallback((resolution: Resolution) => {
    setResolutions(prev => {
      const next = new Map(prev)
      next.set(currentConflict.id, resolution)
      return next
    })

    // If resolution is keep_both, we need a new file name - move to next or auto-generate
    if (resolution === 'keep_both') {
      // Auto-generate a new name by appending timestamp
      const ext = currentConflict.fileName.includes('.')
        ? '.' + currentConflict.fileName.split('.').pop()
        : ''
      const baseName = currentConflict.fileName.replace(ext, '')
      const timestamp = Date.now()
      const autoName = `${baseName}_copy${ext}`
      setNewFileNames(prev => {
        const next = new Map(prev)
        next.set(currentConflict.id, autoName)
        return next
      })
    }
  }, [currentConflict])

  const handleNext = useCallback(() => {
    if (currentIndex < conflicts.length - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }, [currentIndex, conflicts.length])

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }, [currentIndex])

  const handleSubmit = useCallback(async () => {
    setIsResolving(true)

    const results: ConflictResolution[] = conflicts.map(conflict => ({
      conflictId: conflict.id,
      resolution: resolutions.get(conflict.id) || 'skip',
      newFileName: newFileNames.get(conflict.id),
    }))

    onResolve(results)
  }, [conflicts, resolutions, newFileNames, onResolve])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getOperationLabel = (operation: string): string => {
    switch (operation) {
      case 'upload': return 'Upload'
      case 'copy': return 'Copy'
      case 'move': return 'Move'
      case 'sync': return 'Sync'
      default: return 'Transfer'
    }
  }

  const getProviderIcon = (provider?: string): string => {
    switch (provider) {
      case 'google': return '📊'
      case 'onedrive': return '☁️'
      case 'dropbox': return '📦'
      case 'box': return '📁'
      case 'pcloud': return '☁️'
      case 'filen': return '🔒'
      case 'webdav': return '🌐'
      case 'vps': return '🖥️'
      default: return '📄'
    }
  }

  const canSubmit = conflicts.every(
    conflict => resolutions.has(conflict.id) && resolutions.get(conflict.id) !== undefined
  )

  const resolvedCount = resolutions.size
  const totalCount = conflicts.length
  const isSingleConflict = conflicts.length === 1

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[1200] bg-black/50 flex items-center justify-center p-4"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !isResolving) onClose()
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <span className="text-xl">⚠️</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {isSingleConflict ? title : `${title} (${currentIndex + 1}/${totalCount})`}
                </h2>
                {!isSingleConflict && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {resolvedCount} of {totalCount} resolved
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => !isResolving && onClose()}
              disabled={isResolving}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 disabled:opacity-50"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="px-5 py-3 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/30 flex-shrink-0">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {isSingleConflict
              ? description
              : `${getOperationLabel(currentConflict.operation)} conflict: "${currentConflict.fileName}"`}
          </p>
        </div>

        {/* Body - Conflict Details */}
        {currentConflict && (
          <div className="flex-1 overflow-y-auto p-5">
            {/* File info */}
            <div className="mb-6">
              <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <span className="text-3xl">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {currentConflict.fileName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {currentConflict.targetPath}
                  </p>
                </div>
              </div>
            </div>

            {/* Version comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Local Version */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xs">
                      📱
                    </span>
                    Your Version
                  </h3>
                  {currentConflict.localVersion?.provider && (
                    <span className="text-xs text-gray-500">
                      {getProviderIcon(currentConflict.localVersion.provider)}
                    </span>
                  )}
                </div>

                {currentConflict.localVersion ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Size</span>
                      <span className="text-gray-900 dark:text-gray-100 font-medium">
                        {formatFileSize(currentConflict.localVersion.sizeBytes)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Modified</span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {formatDate(currentConflict.localVersion.modifiedAt)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No local version</p>
                )}
              </div>

              {/* Remote Version */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-xs">
                      ☁️
                    </span>
                    Cloud Version
                  </h3>
                  {currentConflict.remoteVersion?.provider && (
                    <span className="text-xs text-gray-500">
                      {getProviderIcon(currentConflict.remoteVersion.provider)}
                    </span>
                  )}
                </div>

                {currentConflict.remoteVersion ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Size</span>
                      <span className="text-gray-900 dark:text-gray-100 font-medium">
                        {formatFileSize(currentConflict.remoteVersion.sizeBytes)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Modified</span>
                      <span className="text-gray-900 dark:text-gray-100">
                        {formatDate(currentConflict.remoteVersion.modifiedAt)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No cloud version</p>
                )}
              </div>
            </div>

            {/* Resolution Options */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                How would you like to resolve this?
              </h3>

              <div className="space-y-3">
                {/* Keep Local */}
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    resolutions.get(currentConflict.id) === 'keep_local'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name={`resolution-${currentConflict.id}`}
                    value="keep_local"
                    checked={resolutions.get(currentConflict.id) === 'keep_local'}
                    onChange={() => handleResolution('keep_local')}
                    className="mt-1 w-4 h-4 text-blue-600"
                    disabled={isResolving}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">Keep mine</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Use your local version and overwrite the cloud file
                    </p>
                  </div>
                  <span className="text-2xl">📱</span>
                </label>

                {/* Keep Remote */}
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    resolutions.get(currentConflict.id) === 'keep_remote'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name={`resolution-${currentConflict.id}`}
                    value="keep_remote"
                    checked={resolutions.get(currentConflict.id) === 'keep_remote'}
                    onChange={() => handleResolution('keep_remote')}
                    className="mt-1 w-4 h-4 text-blue-600"
                    disabled={isResolving}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">Keep cloud</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Use the cloud version and discard your local changes
                    </p>
                  </div>
                  <span className="text-2xl">☁️</span>
                </label>

                {/* Keep Both */}
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    resolutions.get(currentConflict.id) === 'keep_both'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name={`resolution-${currentConflict.id}`}
                    value="keep_both"
                    checked={resolutions.get(currentConflict.id) === 'keep_both'}
                    onChange={() => handleResolution('keep_both')}
                    className="mt-1 w-4 h-4 text-blue-600"
                    disabled={isResolving}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">Keep both</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Keep both files by renaming your local copy
                    </p>
                    {resolutions.get(currentConflict.id) === 'keep_both' && (
                      <input
                        type="text"
                        value={newFileNames.get(currentConflict.id) || ''}
                        onChange={(e) => {
                          setNewFileNames(prev => {
                            const next = new Map(prev)
                            next.set(currentConflict.id, e.target.value)
                            return next
                          })
                        }}
                        placeholder="Enter new filename"
                        className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        disabled={isResolving}
                      />
                    )}
                  </div>
                  <span className="text-2xl">📋</span>
                </label>

                {/* Skip */}
                <label
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    resolutions.get(currentConflict.id) === 'skip'
                      ? 'border-gray-400 bg-gray-50 dark:bg-gray-800'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name={`resolution-${currentConflict.id}`}
                    value="skip"
                    checked={resolutions.get(currentConflict.id) === 'skip'}
                    onChange={() => handleResolution('skip')}
                    className="mt-1 w-4 h-4 text-gray-400"
                    disabled={isResolving}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-700 dark:text-gray-300">Skip this file</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Do not transfer this file and continue with others
                    </p>
                  </div>
                  <span className="text-2xl">⏭️</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          {/* Progress indicator for multiple conflicts */}
          {!isSingleConflict && conflicts.length > 1 && (
            <div className="flex items-center gap-2 mb-4">
              {conflicts.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex
                      ? 'bg-blue-600'
                      : resolutions.has(conflicts[index].id)
                      ? 'bg-green-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  aria-label={`Go to conflict ${index + 1}`}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!isSingleConflict && currentIndex > 0 && (
                <button
                  onClick={handlePrevious}
                  disabled={isResolving}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isSingleConflict ? (
                <>
                  <button
                    onClick={onClose}
                    disabled={isResolving}
                    className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit || isResolving}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isResolving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Resolving...
                      </>
                    ) : (
                      'Resolve'
                    )}
                  </button>
                </>
              ) : (
                <>
                  {currentIndex < conflicts.length - 1 && resolutions.has(currentConflict.id) && (
                    <button
                      onClick={handleNext}
                      disabled={isResolving}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      Next
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )}
                  {currentIndex === conflicts.length - 1 && (
                    <>
                      <button
                        onClick={onClose}
                        disabled={isResolving}
                        className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={!canSubmit || isResolving}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isResolving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            Resolving...
                          </>
                        ) : (
                          `Resolve All (${resolvedCount}/${totalCount})`
                        )}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper hook for using the conflict resolution modal
export function useConflictResolution() {
  const [isOpen, setIsOpen] = useState(false)
  const [conflicts, setConflicts] = useState<Conflict[]>([])

  const showConflicts = useCallback((newConflicts: Conflict[]) => {
    setConflicts(newConflicts)
    setIsOpen(true)
  }, [])

  const hideConflicts = useCallback(() => {
    setIsOpen(false)
    setConflicts([])
  }, [])

  return {
    isOpen,
    conflicts,
    showConflicts,
    hideConflicts,
    ConflictModal: ConflictResolutionModal,
  }
}
