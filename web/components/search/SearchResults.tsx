'use client'

import { SearchFile, SearchResult, providerOptions } from './GlobalSearchBar'

interface SearchResultsProps {
  results: SearchResult | null
  isLoading: boolean
  error: string | null
  query: string
  onFileClick?: (file: SearchFile) => void
  onLoadMore?: (providerId: string, cursor: string) => void
  className?: string
}

// Helper to get file icon based on mime type
function getFileIcon(mimeType?: string, isFolder?: boolean): string {
  if (isFolder) return '📁'
  if (!mimeType) return '📄'
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return '📦'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️'
  if (mimeType.includes('text')) return '📃'
  return '📄'
}

// Helper to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Helper to format date
function formatDate(dateString?: string): string {
  if (!dateString) return 'Unknown'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Get provider icon
function getProviderIcon(providerId: string): string {
  const provider = providerOptions.find(p => p.id === providerId)
  return provider?.icon || '📁'
}

// Get provider display name
function getProviderDisplayName(providerId: string): string {
  const provider = providerOptions.find(p => p.id === providerId)
  return provider?.name || providerId
}

export default function SearchResults({
  results,
  isLoading,
  error,
  query,
  onFileClick,
  onLoadMore,
  className = ''
}: SearchResultsProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">Searching for "{query}"...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-4xl">⚠️</span>
          <p className="text-red-600 dark:text-red-400 font-medium">Search Error</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  // No query state
  if (!query) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-4xl">🔍</span>
          <p className="text-gray-600 dark:text-gray-400">Enter a search term to find files</p>
          <p className="text-gray-500 dark:text-gray-500 text-sm">
            Search across all your connected cloud providers
          </p>
        </div>
      </div>
    )
  }

  // No results state
  if (!results || results.files.length === 0) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-4xl">📭</span>
          <p className="text-gray-600 dark:text-gray-400">No files found</p>
          <p className="text-gray-500 dark:text-gray-500 text-sm">
            No files match "{query}" in your connected providers
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* Results Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-3">
          <span className="text-gray-600 dark:text-gray-400 text-sm">
            Found <span className="font-semibold text-gray-900 dark:text-gray-100">{results.totalResults}</span> results
          </span>
          <span className="text-gray-400 dark:text-gray-600">|</span>
          <span className="text-gray-500 dark:text-gray-500 text-sm">
            Searched <span className="font-medium">{results.providersSearched}</span> providers
          </span>
        </div>
        {results.providersFailed.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <span>⚠️</span>
            <span>{results.providersFailed.length} provider(s) failed</span>
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="space-y-1">
        {results.files.map((file) => (
          <div
            key={`${file.provider}-${file.id}`}
            onClick={() => onFileClick?.(file)}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors group"
          >
            {/* File Icon */}
            <span className="text-2xl flex-shrink-0" title={file.mimeType || 'file'}>
              {getFileIcon(file.mimeType, file.isFolder)}
            </span>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {file.name}
                </span>
                {file.isFolder && (
                  <span className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                    Folder
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 truncate">
                {file.path && (
                  <span className="truncate" title={file.path}>
                    {file.path}
                  </span>
                )}
              </div>
            </div>

            {/* Provider Badge */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">
              <span>{getProviderIcon(file.provider)}</span>
              <span className="text-gray-600 dark:text-gray-400">
                {file.providerDisplayName || getProviderDisplayName(file.provider)}
              </span>
            </div>

            {/* File Size */}
            {!file.isFolder && file.size > 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400 w-20 text-right">
                {formatFileSize(file.size)}
              </div>
            )}

            {/* Modified Date */}
            {file.modifiedAt && (
              <div className="text-sm text-gray-500 dark:text-gray-400 w-36 text-right">
                {formatDate(file.modifiedAt)}
              </div>
            )}

            {/* Actions */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              {file.webUrl && (
                <a
                  href={file.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded"
                  title="Open in provider"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  // TODO: Add download action
                }}
                className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded"
                title="Download"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Load More Buttons */}
      {Object.keys(results.hasMore).some(key => results.hasMore[key]) && (
        <div className="mt-4 flex flex-wrap gap-2 justify-center">
          {Object.entries(results.hasMore).map(([providerId, hasMore]) => {
            if (!hasMore || !results.cursors[providerId]) return null
            return (
              <button
                key={providerId}
                onClick={() => onLoadMore?.(providerId, results.cursors[providerId])}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                Load more from {getProviderDisplayName(providerId)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
