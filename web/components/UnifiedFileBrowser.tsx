'use client'

import { useState, useEffect } from 'react'
import { ProviderId, FileMetadata, PROVIDERS, formatBytes } from '@/lib/providers/types'
import { getProvider } from '@/lib/providers'
import { tokenManager } from '@/lib/tokenManager'

interface ConnectedProvider {
  providerId: ProviderId
  accountEmail: string
  displayName: string
}

interface UnifiedFileBrowserProps {
  token: string
}

export default function UnifiedFileBrowser({ token }: UnifiedFileBrowserProps) {
  const [files, setFiles] = useState<FileMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingProviders, setLoadingProviders] = useState<ProviderId[]>([])
  const [connectedProviders, setConnectedProviders] = useState<ConnectedProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | 'all'>('all')
  const [currentPath, setCurrentPath] = useState('/')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Load connected providers from tokenManager
  useEffect(() => {
    const providerIds: ProviderId[] = ['google', 'onedrive', 'dropbox', 'box', 'pcloud', 'filen', 'yandex', 'vps', 'webdav']
    const connected: ConnectedProvider[] = []
    const loadingIds: ProviderId[] = []

    // Load cloud providers from tokenManager
    for (const pid of providerIds) {
      const token = tokenManager.getToken(pid)
      if (token && token.accessToken) {
        connected.push({
          providerId: pid,
          accountEmail: token.accountEmail || '',
          displayName: token.displayName || pid
        })
        loadingIds.push(pid)
      }
    }

    setConnectedProviders(connected)
    setLoadingProviders(loadingIds)

    // Load files from all connected providers
    async function loadAllFiles() {
      const allFiles: FileMetadata[] = []
      const errors: string[] = []

      // Determine folderId based on currentPath
      // For cloud providers, "/" means "root", otherwise use the path
      const folderId = currentPath === '/' ? 'root' : currentPath

      // Load cloud provider files
      for (const pid of loadingIds) {
        try {
          const provider = getProvider(pid)
          if (provider) {
            const result = await provider.listFiles({ folderId })
            const providerConfig = PROVIDERS.find(p => p.id === pid)
            
            const filesWithProvider = result.files.map(file => ({
              ...file,
              provider: pid,
              providerName: providerConfig?.name || pid
            }))
            
            allFiles.push(...filesWithProvider)
          }
        } catch (err: any) {
          console.error(`Error loading files from ${pid}:`, err)
          errors.push(`${pid}: ${err.message}`)
        }
      }

      if (errors.length > 0) {
        setError(`Some providers failed to load: ${errors.join(', ')}`)
      }

      setFiles(allFiles)
      setLoading(false)
    }

    loadAllFiles()
  }, [token, currentPath, selectedProvider, refreshKey])

  // Filter files by provider
  const filteredFiles = files.filter(f => {
    if (selectedProvider === 'all') return true
    return f.provider === selectedProvider
  })

  // Filter by search query
  const searchedFiles = searchQuery
    ? filteredFiles.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredFiles

  // Sort files
  const sortedFiles = [...searchedFiles].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'date':
        comparison = new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
        break
      case 'size':
        comparison = b.size - a.size
        break
    }
    return sortOrder === 'asc' ? comparison : -comparison
  })

  // Toggle file selection
  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles)
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId)
    } else {
      newSelected.add(fileId)
    }
    setSelectedFiles(newSelected)
  }

  // Select all files
  const selectAll = () => {
    if (selectedFiles.size === sortedFiles.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(sortedFiles.map(f => f.id)))
    }
  }

  // Handle folder click - navigate into folder
  const handleFolderClick = (folderPath: string) => {
    setCurrentPath(folderPath)
  }

  // Handle breadcrumb click
  const handleBreadcrumbClick = (path: string) => {
    setCurrentPath(path)
  }

  // File action handlers
  const handleFileDownload = async (file: FileMetadata) => {
    try {
      const provider = getProvider(file.provider)
      if (provider) {
        const blob = await provider.downloadFile(file.id)
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err: any) {
      console.error('Download error:', err)
      alert('Download failed: ' + err.message)
    }
  }

  const handleFileShare = async (file: FileMetadata) => {
    try {
      const provider = getProvider(file.provider)
      if (provider) {
        const shareLink = await provider.getShareLink(file.id)
        if (shareLink) {
          await navigator.clipboard.writeText(shareLink)
          alert('Share link copied to clipboard!')
        } else {
          alert('Failed to get share link')
        }
      }
    } catch (err: any) {
      console.error('Share error:', err)
      alert('Share failed: ' + err.message)
    }
  }

  const handleFileRename = async (file: FileMetadata) => {
    const newName = prompt('Enter new name:', file.name)
    if (!newName || newName === file.name) return
    try {
      const provider = getProvider(file.provider)
      if (provider) {
        await provider.renameFile(file.id, newName)
        // Reload files
        setRefreshKey(k => k + 1)
      }
    } catch (err: any) {
      console.error('Rename error:', err)
      alert('Rename failed: ' + err.message)
    }
  }

  const handleFileDelete = async (file: FileMetadata) => {
    if (!confirm(`Delete "${file.name}"?`)) return
    try {
      const provider = getProvider(file.provider)
      if (provider) {
        await provider.deleteFile(file.id)
        // Reload files
        setRefreshKey(k => k + 1)
      }
    } catch (err: any) {
      console.error('Delete error:', err)
      alert('Delete failed: ' + err.message)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Provider Filter */}
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value as ProviderId | 'all')}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All Providers ({connectedProviders.length} connected)</option>
          {connectedProviders.map(cp => (
            <option key={cp.providerId} value={cp.providerId}>
              {PROVIDERS.find(p => p.id === cp.providerId)?.name} ({cp.accountEmail})
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [by, order] = e.target.value.split('-') as ['name' | 'date' | 'size', 'asc' | 'desc']
            setSortBy(by)
            setSortOrder(order)
          }}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="size-desc">Largest First</option>
          <option value="size-asc">Smallest First</option>
        </select>

        {/* View Mode Toggle */}
        <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-600`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300'} hover:bg-gray-100 dark:hover:bg-gray-600`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Selection Bar (when files selected) */}
      {selectedFiles.size > 0 && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
          <span className="text-blue-700 dark:text-blue-300">
            {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">
              Copy to...
            </button>
            <button className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">
              Move to...
            </button>
            <button className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600">
              Download
            </button>
            <button className="px-3 py-1 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
              Delete
            </button>
          </div>
        </div>
      )}

      {/* File Count */}
      <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        {sortedFiles.length} file{sortedFiles.length !== 1 ? 's' : ''}
        {selectedProvider !== 'all' && ` on ${PROVIDERS.find(p => p.id === selectedProvider)?.name}`}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : connectedProviders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
          <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="text-lg mb-2">No cloud providers connected</p>
          <p className="text-sm mb-4">Connect a cloud storage provider to browse your files</p>
          <a
            href="/remotes"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Connect Provider
          </a>
        </div>
      ) : sortedFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
          <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p>No files found</p>
          {selectedProvider !== 'all' && (
            <button
              onClick={() => setSelectedProvider('all')}
              className="mt-2 text-blue-500 hover:underline"
            >
              Show files from all providers
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedFiles.size === sortedFiles.length && sortedFiles.length > 0}
                    onChange={selectAll}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Provider
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Modified
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedFiles.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  selected={selectedFiles.has(file.id)}
                  onSelect={() => toggleFileSelection(file.id)}
                  onFolderClick={handleFolderClick}
                  onDownload={handleFileDownload}
                  onShare={handleFileShare}
                  onRename={handleFileRename}
                  onDelete={handleFileDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sortedFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              selected={selectedFiles.has(file.id)}
              onSelect={() => toggleFileSelection(file.id)}
              onFolderClick={handleFolderClick}
              onDownload={handleFileDownload}
              onShare={handleFileShare}
              onRename={handleFileRename}
              onDelete={handleFileDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// File Row Component (List View)
interface FileRowProps {
  file: FileMetadata
  selected: boolean
  onSelect: () => void
  onFolderClick: (path: string) => void
  onDownload: (file: FileMetadata) => void
  onShare: (file: FileMetadata) => void
  onRename: (file: FileMetadata) => void
  onDelete: (file: FileMetadata) => void
}

function FileRow({ file, selected, onSelect, onFolderClick, onDownload, onShare, onRename, onDelete }: FileRowProps) {
  const provider = PROVIDERS.find(p => p.id === file.provider)

  const handleClick = () => {
    if (file.isFolder) {
      onFolderClick(file.path)
    }
  }

  return (
    <tr
      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selected ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${file.isFolder ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="rounded border-gray-300 dark:border-gray-600"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex items-center justify-center text-lg">
            {file.isFolder ? '📁' : getFileIcon(file.mimeType)}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
              {file.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
              {file.pathDisplay}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: provider?.color || '#888' }}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {file.providerName}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {file.isFolder ? '—' : formatBytes(file.size)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {formatDate(file.modifiedTime)}
      </td>
      <td className="px-4 py-3 text-right">
        <FileActions
          file={file}
          onDownload={onDownload}
          onShare={onShare}
          onRename={onRename}
          onDelete={onDelete}
        />
      </td>
    </tr>
  )
}

// File Card Component (Grid View)
function FileCard({ file, selected, onSelect, onFolderClick, onDownload, onShare, onRename, onDelete }: FileRowProps) {
  const provider = PROVIDERS.find(p => p.id === file.provider)

  const handleClick = (e: React.MouseEvent) => {
    if (file.isFolder) {
      e.stopPropagation()
      onFolderClick(file.path)
    } else {
      onSelect()
    }
  }

  return (
    <div
      className={`relative bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border-2 cursor-pointer transition-all hover:shadow-md ${
        selected ? 'border-blue-500' : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'
      }`}
      onClick={handleClick}
    >
      {selected && (
        <div className="absolute top-2 right-2">
          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}

      <div className="text-4xl mb-3 text-center">
        {file.isFolder ? '📁' : getFileIcon(file.mimeType)}
      </div>

      <p className="font-medium text-gray-900 dark:text-white text-sm truncate mb-1">
        {file.name}
      </p>

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: provider?.color || '#888' }}
          />
          <span>{file.providerName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>{file.isFolder ? '—' : formatBytes(file.size)}</span>
          <FileActions
            file={file}
            onDownload={onDownload}
            onShare={onShare}
            onRename={onRename}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  )
}

// File Actions Dropdown
interface FileActionsProps {
  file: FileMetadata
  onDownload: (file: FileMetadata) => void
  onShare: (file: FileMetadata) => void
  onRename: (file: FileMetadata) => void
  onDelete: (file: FileMetadata) => void
}

function FileActions({ file, onDownload, onShare, onRename, onDelete }: FileActionsProps) {
  const [showMenu, setShowMenu] = useState(false)

  const handleAction = (action: () => void) => {
    action()
    setShowMenu(false)
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
      >
        <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
          <button
            onClick={() => handleAction(() => onDownload(file))}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
          <button
            onClick={() => handleAction(() => onShare(file))}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share link
          </button>
          <button
            onClick={() => handleAction(() => onRename(file))}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Rename
          </button>
          <hr className="my-1 border-gray-200 dark:border-gray-700" />
          <button
            onClick={() => handleAction(() => onDelete(file))}
            className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// Helper Functions
function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType.includes('pdf')) return '📄'
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️'
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('tar') || mimeType.includes('gzip')) return '📦'
  if (mimeType.startsWith('text/')) return '📃'
  return '📄'
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString()
}
