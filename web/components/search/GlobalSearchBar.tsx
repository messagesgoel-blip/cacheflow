'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

// Types based on contract 5.11
export interface SearchFile {
  id: string
  name: string
  isFolder: boolean
  size: number
  parentId?: string
  path?: string
  mimeType?: string
  etag?: string
  checksum?: string
  createdAt?: string
  modifiedAt?: string
  webUrl?: string
  provider: string
  providerDisplayName: string
}

export interface SearchResult {
  files: SearchFile[]
  cursors: Record<string, string>
  hasMore: Record<string, boolean>
  totalResults: number
  providersSearched: number
  providersFailed: string[]
}

export interface SearchResponse {
  success: boolean
  data?: SearchResult
  error?: string
}

interface GlobalSearchBarProps {
  onSearch: (query: string, options?: SearchOptions) => Promise<void>
  isLoading?: boolean
  placeholder?: string
  className?: string
}

interface SearchOptions {
  providerIds?: string[]
  folderId?: string
  pageSize?: number
}

// Provider options for filtering
export const providerOptions = [
  { id: 'google', name: 'Google Drive', icon: '📁' },
  { id: 'onedrive', name: 'OneDrive', icon: '☁️' },
  { id: 'dropbox', name: 'Dropbox', icon: '📦' },
  { id: 'box', name: 'Box', icon: '📥' },
  { id: 'pcloud', name: 'pCloud', icon: '☁️' },
  { id: 'filen', name: 'Filen', icon: '🔒' },
  { id: 'webdav', name: 'WebDAV', icon: '🌐' },
  { id: 'yandex', name: 'Yandex Disk', icon: '💾' },
]

export default function GlobalSearchBar({
  onSearch,
  isLoading = false,
  placeholder = 'Search files across all providers...',
  className = ''
}: GlobalSearchBarProps) {
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedProviders, setSelectedProviders] = useState<string[]>([])
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  // Debounce the search query
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [query])

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      onSearch(debouncedQuery, {
        providerIds: selectedProviders.length > 0 ? selectedProviders : undefined,
        pageSize: 50
      })
    }
  }, [debouncedQuery, selectedProviders, onSearch])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim().length >= 2) {
      onSearch(query.trim(), {
        providerIds: selectedProviders.length > 0 ? selectedProviders : undefined,
        pageSize: 50
      })
    }
  }, [query, selectedProviders, onSearch])

  const handleClear = useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
    inputRef.current?.focus()
  }, [])

  const toggleProvider = useCallback((providerId: string) => {
    setSelectedProviders(prev =>
      prev.includes(providerId)
        ? prev.filter(p => p !== providerId)
        : [...prev, providerId]
    )
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClear()
    }
  }, [handleClear])

  return (
    <div className={`w-full ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              disabled={isLoading}
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg
                  className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-lg border transition-colors ${
              showFilters || selectedProviders.length > 0
                ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title="Filter by provider"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </button>
          <button
            type="submit"
            disabled={isLoading || query.trim().length < 2}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Searching...
              </span>
            ) : 'Search'}
          </button>
        </div>

        {/* Provider Filter Dropdown */}
        {showFilters && (
          <div className="absolute z-10 mt-2 w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by provider
            </div>
            <div className="flex flex-wrap gap-2">
              {providerOptions.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => toggleProvider(provider.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedProviders.includes(provider.id)
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <span>{provider.icon}</span>
                  <span>{provider.name}</span>
                </button>
              ))}
            </div>
            {selectedProviders.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedProviders([])}
                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </form>

      {/* Active Filters Display */}
      {selectedProviders.length > 0 && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Filtering by:</span>
          {selectedProviders.map((providerId) => {
            const provider = providerOptions.find(p => p.id === providerId)
            return provider ? (
              <span
                key={providerId}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full"
              >
                {provider.icon} {provider.name}
                <button
                  onClick={() => toggleProvider(providerId)}
                  className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                >
                  ×
                </button>
              </span>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}
