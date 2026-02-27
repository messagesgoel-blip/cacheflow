'use client'

import { useState, useEffect, useRef } from 'react'
import { browseFiles } from '@/lib/api'
import { getProvider } from '@/lib/providers'
import { ProviderId } from '@/lib/providers/types'

interface FolderItem {
  name: string
  path: string
  isFolder: boolean
  itemCount?: number
}

interface FolderTreeProps {
  token: string
  locationId?: string
  currentPath: string
  onFolderSelect: (path: string) => void
  onRefresh?: () => void
}

export default function FolderTree({ token, locationId, currentPath, onFolderSelect, onRefresh }: FolderTreeProps) {
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedPathsRef = useRef<Set<string>>(new Set())

  // Check if we're viewing a cloud provider
  const isCloud = locationId?.startsWith('cloud-') ?? false
  const cloudProviderId = isCloud ? locationId?.replace('cloud-', '') as ProviderId : null

  // Load root folders on mount
  useEffect(() => {
    setFolders([])
    setExpandedFolders(new Set())
    loadedPathsRef.current = new Set()
    loadFolders('/')
  }, [token, locationId])

  // Load folders for current path when it changes
  useEffect(() => {
    if (currentPath) {
      const parentPath = getParentPath(currentPath)
      if (parentPath !== currentPath) {
        ensureFolderLoaded(parentPath)
      }
      ensureFolderLoaded(currentPath)
    }
  }, [currentPath])

  async function loadFolders(path: string) {
    if (!token) return

    // Skip if already loaded
    if (loadedPathsRef.current.has(path)) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      let folderItems: FolderItem[] = []

      // Handle cloud provider
      if (isCloud && cloudProviderId) {
        const provider = getProvider(cloudProviderId)
        if (provider) {
          const result = await provider.listFiles({ folderId: path })
          folderItems = result.files
            .filter((f: any) => f.isFolder)
            .map((f: any) => ({
              name: f.name,
              path: f.id,  // Use ID for cloud providers
              isFolder: true,
              itemCount: undefined
            }))
        }
      } else {
        // Handle local storage
        const data = await browseFiles(path, token, locationId)
        folderItems = data.folders || []
      }
      
      // Mark as loaded
      loadedPathsRef.current.add(path)
      
      setFolders(prev => {
        // Merge new folders with existing, avoiding duplicates
        const newFolders = [...prev]
        folderItems.forEach((folder: FolderItem) => {
          if (!newFolders.some(f => f.path === folder.path)) {
            newFolders.push(folder)
          }
        })
        return newFolders.sort((a, b) => a.name.localeCompare(b.name))
      })
    } catch (err: any) {
      setError(err.message || 'Failed to load folders')
      console.error('Failed to load folders:', err)
    } finally {
      setLoading(false)
    }
  }

  async function ensureFolderLoaded(path: string) {
    // Skip if already loaded
    if (loadedPathsRef.current.has(path)) {
      return
    }
    // Load folder if not already in the loaded set
    await loadFolders(path)
  }

  function getParentPath(path: string): string {
    if (path === '/') return '/'
    const parts = path.split('/').filter(p => p !== '')
    if (parts.length <= 1) return '/'
    return '/' + parts.slice(0, -1).join('/')
  }

  function toggleFolder(path: string) {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
      // Load folder contents when expanded
      loadFolders(path)
    }
    setExpandedFolders(newExpanded)
  }

  function handleFolderClick(path: string) {
    onFolderSelect(path)
  }

  function renderFolder(folder: FolderItem, level = 0) {
    const isExpanded = expandedFolders.has(folder.path)
    const isCurrent = currentPath === folder.path
    const hasChildren = folders.some(f => getParentPath(f.path) === folder.path)

    return (
      <div key={folder.path} className="select-none">
        <div
          className={`flex items-center py-1 px-2 rounded hover:bg-gray-100 cursor-pointer ${isCurrent ? 'bg-blue-50 text-blue-700' : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => handleFolderClick(folder.path)}
        >
          <button
            className="w-4 h-4 mr-1 flex items-center justify-center text-gray-400 hover:text-gray-600"
            onClick={(e) => {
              e.stopPropagation()
              toggleFolder(folder.path)
            }}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              isExpanded ? '▼' : '▶'
            ) : (
              <span className="w-4"></span>
            )}
          </button>
          <span className="truncate flex-1">
            📁 {folder.name}
            {folder.itemCount !== undefined && (
              <span className="ml-1 text-xs text-gray-400">({folder.itemCount})</span>
            )}
          </span>
        </div>
        {isExpanded && hasChildren && (
          <div>
            {folders
              .filter(f => getParentPath(f.path) === folder.path)
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const rootFolders = folders.filter(f => getParentPath(f.path) === '/')

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-800">
      <div className="p-3 border-b dark:border-gray-700 flex justify-between items-center">
        <h3 className="font-medium text-gray-700 dark:text-gray-200">Folders</h3>
        <button
          onClick={() => {
            loadedPathsRef.current.clear()
            loadFolders('/')
            onRefresh?.()
          }}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          disabled={loading}
        >
          {loading ? '↻' : '↻'}
        </button>
      </div>
      <div className="p-2 max-h-[400px] overflow-y-auto">
        {error && (
          <div className="p-2 mb-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded">
            {error}
          </div>
        )}

        {/* Root/Home folder */}
        <div
          className={`flex items-center py-1 px-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${currentPath === '/' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : ''}`}
          onClick={() => handleFolderClick('/')}
        >
          <span className="w-4 mr-1">🏠</span>
          <span className="truncate">Home</span>
        </div>

        {/* All folders */}
        {rootFolders.length > 0 ? (
          rootFolders
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(folder => renderFolder(folder))
        ) : (
          <div className="p-4 text-center text-gray-400 text-sm">
            {loading ? 'Loading folders...' : 'No folders yet'}
          </div>
        )}
      </div>
      <div className="p-2 border-t dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex justify-between">
          <span>{folders.length} folders</span>
          <button
            onClick={() => onFolderSelect('/')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  )
}
