'use client'

import { useState, useEffect, useRef } from 'react'
import { browseFiles, uploadFile, createFolder, deleteFolder, moveFile } from '@/lib/api'
import { getProvider } from '@/lib/providers'
import { ProviderId, PROVIDERS, FileMetadata } from '@/lib/providers/types'
import FileTable from './FileTable'
import Breadcrumb from './Breadcrumb'
import { useContextMenu, contextMenuItems } from './ContextMenu'
import { useActionCenter } from '@/components/ActionCenterProvider'

interface FileBrowserProps {
  token: string
  currentPath?: string
  locationId?: string
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

export default function FileBrowser({ token, currentPath = '/', locationId, onPathChange, onRefresh }: FileBrowserProps) {
  const [browseData, setBrowseData] = useState<BrowseResult | null>(null)
  const [cloudFiles, setCloudFiles] = useState<FileMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [unimplementedMsg, setUnimplementedMsg] = useState<string | null>(null)
  const actions = useActionCenter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { contextMenu, showContextMenu, hideContextMenu, ContextMenuComponent } = useContextMenu()

  // Component-level derived values for cloud provider detection
  const isCloud = locationId?.startsWith('cloud-') ?? false
  const cloudProviderId = isCloud ? locationId?.replace('cloud-', '') as ProviderId : null

  // Load current path on mount and when path changes
  useEffect(() => {
    loadCurrentPath()
  }, [currentPath, token, locationId])

  async function loadCurrentPath() {
    if (!token) return

    setLoading(true)
    setError(null)

    try {
      // Handle cloud provider
      if (isCloud && cloudProviderId) {
        console.log('[FileBrowser] Cloud provider detected:', cloudProviderId)
        const provider = getProvider(cloudProviderId)
        if (provider) {
          console.log('[FileBrowser] Loading files from provider:', cloudProviderId)
          // Convert "/" to "root" for cloud providers
          const folderId = currentPath === '/' ? 'root' : currentPath
          const result = await provider.listFiles({ folderId })
          console.log('[FileBrowser] Got files:', result.files.length, 'files')
          const providerConfig = PROVIDERS.find(p => p.id === cloudProviderId)
          
          // Convert cloud files to browseData format
          const folders = result.files.filter(f => f.isFolder).map(f => ({
            name: f.name,
            path: f.id,
            isFolder: true,
            itemCount: undefined  // Cloud folders - count requires extra API call
          }))
          
          const files = result.files.filter(f => !f.isFolder).map(f => ({
            name: f.name,
            path: f.id,
            isFolder: false,
            size_bytes: f.size,
            last_modified: f.modifiedTime,
            status: 'synced' // Cloud files are considered synced
          }))

          setCloudFiles(result.files)
          setBrowseData({
            path: currentPath,
            folders,
            files,
            totalItems: result.files.length
          })
        } else {
          console.error('[FileBrowser] Provider not found:', cloudProviderId)
          setError(`Provider ${cloudProviderId} not found`)
        }
        setLoading(false)
        return
      }

      // Handle local storage
      const data = await browseFiles(currentPath, token)
      setBrowseData(data)
    } catch (err: any) {
      console.error('[FileBrowser] Error loading files:', err)
      setError(err.message || 'Failed to load files')
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
      // Handle cloud provider upload
      if (isCloud && cloudProviderId) {
        const provider = getProvider(cloudProviderId)
        if (provider) {
          await provider.uploadFile(file, { folderId: currentPath === '/' ? 'root' : currentPath })
          console.log('[FileBrowser] Uploaded to cloud provider:', cloudProviderId)
        } else {
          throw new Error(`Provider ${cloudProviderId} not found`)
        }
      } else {
        // Handle local storage upload
        await uploadFile(file, token, currentPath === '/' ? undefined : currentPath)
      }
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
      // Handle cloud provider folder creation
      if (isCloud && cloudProviderId) {
        const provider = getProvider(cloudProviderId)
        if (provider) {
          await provider.createFolder(newFolderName, currentPath === '/' ? 'root' : currentPath)
          console.log('[FileBrowser] Created folder in cloud provider:', cloudProviderId)
        } else {
          throw new Error(`Provider ${cloudProviderId} not found`)
        }
      } else {
        // Handle local storage folder creation
        const folderPath = currentPath === '/' ? newFolderName : `${currentPath}/${newFolderName}`
        await createFolder(folderPath, token)
      }
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
    const ok = await actions.confirm({
      title: 'Delete folder?',
      message: `Delete folder "${folderPath.split('/').pop()}"? This will only delete empty folders.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    })
    if (!ok) return

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
        setUnimplementedMsg('Folder rename not yet implemented')
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
    try {
      if (isCloud && cloudProviderId) {
        const provider = getProvider(cloudProviderId)
        if (provider) {
          const blob = await provider.downloadFile(fileId)
          // Create download link
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filePath.split('/').pop() || 'download'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          return
        }
      }
      // For local/VPS, use API
      const response = await fetch(`/api/files/download?path=${encodeURIComponent(filePath)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filePath.split('/').pop() || 'download'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Download error:', err)
      setError(err.message || 'Download failed')
    }
  }

  async function handleShare(fileId: string, filePath: string) {
    try {
      let shareLink = ''
      if (isCloud && cloudProviderId) {
        const provider = getProvider(cloudProviderId)
        if (provider) {
          shareLink = await provider.getShareLink(fileId) || ''
        }
      }
      if (shareLink) {
        await navigator.clipboard.writeText(shareLink)
        setUnimplementedMsg('Share link copied to clipboard!')
      } else {
        // For local/VPS, create a share token via API
        const response = await fetch('/api/share', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ filePath })
        })
        if (!response.ok) throw new Error('Failed to create share link')
        const data = await response.json()
        const link = `${window.location.origin}/share/${data.token}`
        await navigator.clipboard.writeText(link)
        setUnimplementedMsg('Share link copied to clipboard!')
      }
    } catch (err: any) {
      console.error('Share error:', err)
      setError(err.message || 'Failed to create share link')
    }
  }

  async function handleRename(fileId: string, filePath: string) {
    const newName = await actions.prompt({
      title: 'Rename file',
      message: filePath.split('/').pop() || filePath,
      initial: filePath.split('/').pop() || '',
      placeholder: 'New name',
      confirmText: 'Rename',
    })
    if (!newName || newName === filePath.split('/').pop()) return

    try {
      if (isCloud && cloudProviderId) {
        const provider = getProvider(cloudProviderId)
        if (provider) {
          await provider.renameFile(fileId, newName)
          await loadCurrentPath()
          return
        }
      }
      // For local/VPS, use API
      const response = await fetch('/api/files/rename', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ path: filePath, newName })
      })
      if (!response.ok) throw new Error('Rename failed')
      await loadCurrentPath()
    } catch (err: any) {
      console.error('Rename error:', err)
      setError(err.message || 'Rename failed')
    }
  }

  async function handleMove(fileId: string, filePath: string) {
    const newPath = await actions.prompt({
      title: 'Move file',
      message: filePath.split('/').pop() || filePath,
      initial: '/',
      placeholder: '/Destination',
      confirmText: 'Move',
    })
    if (!newPath) return

    try {
      if (isCloud && cloudProviderId) {
        const provider = getProvider(cloudProviderId)
        if (provider) {
          await provider.moveFile(fileId, newPath)
          await loadCurrentPath()
          return
        }
      }
      // For local/VPS, use API
      const response = await fetch('/api/files/move', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ path: filePath, newPath })
      })
      if (!response.ok) throw new Error('Move failed')
      await loadCurrentPath()
    } catch (err: any) {
      console.error('Move error:', err)
      setError(err.message || 'Move failed')
    }
  }

  async function handleDelete(fileId: string) {
    // Find the file to get its path
    const file = files.find(f => f.path === fileId || f.id === fileId)
    if (!file) {
      setError('File not found')
      return
    }

    const ok = await actions.confirm({
      title: 'Delete file?',
      message: `Delete "${file.name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    })
    if (!ok) return

    try {
      if (isCloud && cloudProviderId) {
        const provider = getProvider(cloudProviderId)
        if (provider) {
          await provider.deleteFile(fileId)
          await loadCurrentPath()
          return
        }
      }
      // For local/VPS, use API
      const response = await fetch(`/api/files?path=${encodeURIComponent(file.path)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Delete failed')
      await loadCurrentPath()
    } catch (err: any) {
      console.error('Delete error:', err)
      setError(err.message || 'Delete failed')
    }
  }

  async function handleRetry(fileId: string) {
    setUnimplementedMsg('Retry is not yet implemented')
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
        <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded border border-red-200 dark:border-red-800 text-sm">
          {error}
        </div>
      )}

      {/* Unimplemented feature notice */}
      {unimplementedMsg && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded border border-yellow-200 dark:border-yellow-800 text-sm flex justify-between items-center">
          <span>{unimplementedMsg}</span>
          <button onClick={() => setUnimplementedMsg(null)} className="text-yellow-600 hover:text-yellow-800">×</button>
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
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {browseData?.totalItems || 0} items
          </span>
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className="px-2 py-1 text-sm border dark:border-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {viewMode === 'list' ? 'Grid View' : 'List View'}
          </button>
        </div>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded border dark:border-gray-600">
          <div className="flex gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="flex-1 border dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded px-3 py-1.5 text-sm"
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
              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
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
              className="border rounded-lg p-3 bg-white dark:bg-gray-700 hover:shadow-sm cursor-pointer group dark:border-gray-600"
              onClick={() => handleFolderClick(folder.path)}
              onContextMenu={(e) => handleFolderContextMenu(e, folder)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📁</span>
                  <span className="font-medium text-sm truncate dark:text-white">
                    {folder.name}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteFolder(folder.path)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  title="Delete folder"
                >
                  ×
                </button>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {folder.itemCount !== undefined ? `${folder.itemCount} items` : '-'}
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
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          <p className="mb-2">This folder is empty</p>
          <p className="text-sm">Upload a file or create a folder to get started</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8 text-gray-400 dark:text-gray-500">
          Loading...
        </div>
      )}

      {/* Context Menu */}
      {ContextMenuComponent}
    </div>
  )
}
