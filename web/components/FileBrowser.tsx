'use client'

import { useState, useEffect, useRef } from 'react'
import { browseFiles, uploadFile, createFolder, deleteFolder, moveFile } from '@/lib/api'
import FileTable from './FileTable'
import Breadcrumb from './Breadcrumb'
import { useContextMenu, contextMenuItems } from './ContextMenu'

interface FileBrowserProps {
  token: string
  currentPath?: string
  onPathChange?: (path: string) => void
  onRefresh?: () => void
}

interface BrowseResult {
  path: string
  folders: Array<{
    name: string
    path: string
    isFolder: boolean
    itemCount?: number
  }>
  files: Array<any>
  totalItems: number
}

export default function FileBrowser({ token, currentPath = '/', onPathChange, onRefresh }: FileBrowserProps) {
  const [browseData, setBrowseData] = useState<BrowseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { contextMenu, showContextMenu, hideContextMenu, ContextMenuComponent } = useContextMenu()

  // Load current path on mount and when path changes
  useEffect(() => {
    loadCurrentPath()
  }, [currentPath, token])

  async function loadCurrentPath() {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      const data = await browseFiles(currentPath, token)
      setBrowseData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load files')
      console.error('Failed to load browse data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return

    setUploading(true)
    setError(null)

    try {
      await uploadFile(file, token, currentPath === '/' ? undefined : currentPath)
      await loadCurrentPath()
      onRefresh?.()
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      // Clear the file input
      if (e.target) {
        e.target.value = ''
      }
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim() || !token) return

    setCreatingFolder(true)
    setError(null)

    try {
      const folderPath = currentPath === '/' ? newFolderName : `${currentPath}/${newFolderName}`
      await createFolder(folderPath, token)
      setNewFolderName('')
      setShowNewFolder(false)
      await loadCurrentPath()
      onRefresh?.()
    } catch (err: any) {
      setError(err.message || 'Failed to create folder')
    } finally {
      setCreatingFolder(false)
    }
  }

  async function handleDeleteFolder(folderPath: string) {
    if (!token || !confirm(`Delete folder "${folderPath.split('/').pop()}"? This will only delete empty folders.`)) {
      return
    }

    try {
      await deleteFolder(folderPath, token)
      await loadCurrentPath()
      onRefresh?.()
    } catch (err: any) {
      setError(err.message || 'Failed to delete folder')
    }
  }

  async function handleMoveFile(fileId: string, newPath: string) {
    if (!token) return

    try {
      await moveFile(fileId, newPath, token)
      await loadCurrentPath()
      onRefresh?.()
    } catch (err: any) {
      setError(err.message || 'Failed to move file')
    }
  }

  function handleFolderClick(path: string) {
    onPathChange?.(path)
  }

  function handleBreadcrumbClick(path: string) {
    onPathChange?.(path)
  }

  function triggerFileInput() {
    fileInputRef.current?.click()
  }

  // Context menu handlers
  function handleFileContextMenu(e: React.MouseEvent, file: any) {
    e.preventDefault()

    const items = contextMenuItems.file(file, {
      onDownload: () => handleDownload(file.id, file.path),
      onShare: () => handleShare(file.id, file.path),
      onRename: () => handleRename(file.id, file.path),
      onMove: () => handleMove(file.id, file.path),
      onDelete: () => handleDelete(file.id),
      onRetry: file.status === 'error' ? () => handleRetry(file.id) : undefined
    })

    showContextMenu(e.clientX, e.clientY, items)
  }

  function handleFolderContextMenu(e: React.MouseEvent, folder: any) {
    e.preventDefault()

    const items = contextMenuItems.folder(folder, {
      onOpen: () => handleFolderClick(folder.path),
      onUpload: () => {
        // Set current path to this folder then trigger upload
        onPathChange?.(folder.path)
        setTimeout(() => triggerFileInput(), 100)
      },
      onCreateFolder: () => {
        onPathChange?.(folder.path)
        setTimeout(() => {
          setShowNewFolder(true)
          setNewFolderName('')
        }, 100)
      },
      onRename: () => {
        // TODO: Implement folder rename
        alert('Folder rename not yet implemented')
      },
      onDelete: () => handleDeleteFolder(folder.path)
    })

    showContextMenu(e.clientX, e.clientY, items)
  }

  function handleEmptySpaceContextMenu(e: React.MouseEvent) {
    e.preventDefault()

    const items = contextMenuItems.emptySpace({
      onUpload: triggerFileInput,
      onCreateFolder: () => {
        setShowNewFolder(true)
        setNewFolderName('')
      },
      onRefresh: () => loadCurrentPath()
    })

    showContextMenu(e.clientX, e.clientY, items)
  }

  // Helper functions for context menu actions
  async function handleDownload(fileId: string, filePath: string) {
    // TODO: Implement download
    console.log('Download file:', fileId, filePath)
  }

  async function handleShare(fileId: string, filePath: string) {
    // TODO: Implement share
    console.log('Share file:', fileId, filePath)
  }

  async function handleRename(fileId: string, filePath: string) {
    // TODO: Implement rename via FileTable
    console.log('Rename file:', fileId, filePath)
  }

  async function handleMove(fileId: string, filePath: string) {
    // TODO: Implement move via FileTable
    console.log('Move file:', fileId, filePath)
  }

  async function handleDelete(fileId: string) {
    // TODO: Implement delete
    console.log('Delete file:', fileId)
  }

  async function handleRetry(fileId: string) {
    // TODO: Implement retry
    console.log('Retry file:', fileId)
  }

  const files = browseData?.files || []
  const folders = browseData?.folders || []

  return (
    <div
      className="space-y-4"
      onContextMenu={handleEmptySpaceContextMenu}
    >
      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Breadcrumb */}
      <Breadcrumb path={currentPath} onSegmentClick={handleBreadcrumbClick} />

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={triggerFileInput}
            disabled={uploading}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </button>
          <button
            onClick={() => setShowNewFolder(true)}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            New Folder
          </button>
          <button
            onClick={() => loadCurrentPath()}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {browseData?.totalItems || 0} items
          </span>
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
          >
            {viewMode === 'list' ? 'Grid View' : 'List View'}
          </button>
        </div>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="p-3 bg-gray-50 rounded border">
          <div className="flex gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="flex-1 border rounded px-3 py-1.5 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder()
                if (e.key === 'Escape') {
                  setShowNewFolder(false)
                  setNewFolderName('')
                }
              }}
              autoFocus
            />
            <button
              onClick={handleCreateFolder}
              disabled={creatingFolder || !newFolderName.trim()}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {creatingFolder ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => {
                setShowNewFolder(false)
                setNewFolderName('')
              }}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        className="hidden"
      />

      {/* Folders grid */}
      {folders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {folders.map(folder => (
            <div
              key={folder.path}
              className="border rounded-lg p-3 bg-white hover:shadow-sm cursor-pointer group"
              onClick={() => handleFolderClick(folder.path)}
              onContextMenu={(e) => handleFolderContextMenu(e, folder)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📁</span>
                  <span className="font-medium text-sm truncate">
                    {folder.name}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteFolder(folder.path)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700"
                  title="Delete folder"
                >
                  ×
                </button>
              </div>
              <div className="text-xs text-gray-500">
                {folder.itemCount || 0} items
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Files table/grid */}
      {files.length > 0 ? (
        <FileTable
          files={files}
          token={token}
          onRefresh={() => {
            loadCurrentPath()
            onRefresh?.()
          }}
          viewMode={viewMode}
          currentPath={currentPath}
          onMoveFile={handleMoveFile}
        />
      ) : folders.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-400">
          <p className="mb-2">This folder is empty</p>
          <p className="text-sm">Upload a file or create a folder to get started</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8 text-gray-400">
          Loading...
        </div>
      )}

      {/* Context Menu */}
      {ContextMenuComponent}
    </div>
  )
}