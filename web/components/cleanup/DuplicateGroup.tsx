'use client'

import { useState } from 'react'
import { formatFileSize } from '@/lib/utils/format'

interface DuplicateFile {
  id: string
  providerId: string
  name: string
  size: number
  parentId: string
  path: string
  mimeType: string
  modifiedAt: string
  webUrl?: string
}

interface DuplicateGroup {
  signature: string
  fileName: string
  fileSize: number
  files: DuplicateFile[]
}

interface DuplicateGroupProps {
  group: DuplicateGroup
  onDelete?: (fileId: string) => void
  onKeep?: (fileId: string) => void
}

export default function DuplicateGroup({ group, onDelete, onKeep }: DuplicateGroupProps) {
  const [expanded, setExpanded] = useState(true)
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set())

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      })
      }

  function getProviderIcon(providerId: string): string {
    const icons: Record<string, string> = {
      google: '📧',
      dropbox: '📦',
      onedrive: '☁️',
      local: '💻'
    }
    return icons[providerId] || '📁'
  }

  function getMimeIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.startsWith('video/')) return '🎬'
    if (mimeType.startsWith('audio/')) return '🎵'
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊'
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️'
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦'
    if (mimeType.includes('text')) return '📃'
    return '📄'
  }

  function toggleSelect(fileId: string) {
    const newSelected = new Set(selectedToDelete)
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId)
    } else {
      newSelected.add(fileId)
    }
    setSelectedToDelete(newSelected)
  }

  function handleDeleteSelected() {
    selectedToDelete.forEach(fileId => {
      onDelete?.(fileId)
    })
    setSelectedToDelete(new Set())
  }

  function handleKeep(fileId: string) {
    onKeep?.(fileId)
  }

  const wastedSpace = (group.files.length - 1) * group.fileSize

  return (
    <div className="border dark:border-gray-700 rounded-lg overflow-hidden mb-4">
      {/* Group header */}
      <div
        className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{getMimeIcon(group.files[0]?.mimeType || '')}</span>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {group.fileName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {group.files.length} copies · {formatFileSize(group.fileSize)} each
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {formatFileSize(wastedSpace)} wasted
            </span>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="p-4 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select files to remove. Keep at least one copy.
            </p>
            {selectedToDelete.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete {selectedToDelete.size} Selected
              </button>
            )}
          </div>

          <div className="space-y-2">
            {group.files.map((file, index) => (
              <div
                key={file.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  selectedToDelete.has(file.id)
                    ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedToDelete.has(file.id)}
                  onChange={() => toggleSelect(file.id)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />

                <span className="text-xl">{getProviderIcon(file.providerId)}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {file.providerId}
                    </span>
                    {index === 0 && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs rounded">
                        Newest
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                    {file.path}
                  </p>
                </div>

                <div className="text-right text-sm text-gray-600 dark:text-gray-400">
                  <div>{formatFileSize(file.size)}</div>
                  <div className="text-xs">{formatDate(file.modifiedAt)}</div>
                </div>

                <div className="flex gap-2">
                  {file.webUrl && (
                    <a
                      href={file.webUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Open in provider"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                  <button
                    onClick={() => handleKeep(file.id)}
                    className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                    title="Keep this version"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
