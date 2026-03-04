'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { FileMetadata } from '@/lib/providers/types'

interface FileTableProps {
  files: FileMetadata[]
  loading?: boolean
  /** Single click: select file */
  onFileSelect?: (file: FileMetadata) => void
  /** Double click: open file */
  onFileOpen?: (file: FileMetadata) => void
  /** Currently selected file IDs */
  selectedFiles?: Set<string>
  onSort?: (column: 'name' | 'size' | 'modifiedTime', direction: 'asc' | 'desc') => void
  sortColumn?: 'name' | 'size' | 'modifiedTime'
  sortDirection?: 'asc' | 'desc'
}

// Skeleton loader for table rows
function FileRowSkeleton() {
  return (
    <tr className="file-row-skeleton">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="skeleton-icon" />
          <div className="skeleton-text w-48" />
        </div>
      </td>
      <td className="py-3 px-4">
        <div className="skeleton-text w-16" />
      </td>
      <td className="py-3 px-4">
        <div className="skeleton-text w-24" />
      </td>
      <td className="py-3 px-4">
        <div className="skeleton-text w-20" />
      </td>
    </tr>
  )
}

// Skeleton for empty/loading state
function TableSkeleton() {
  return (
    <div className="file-table-skeleton">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
              <div className="skeleton-text w-16" />
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
              <div className="skeleton-text w-12" />
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
              <div className="skeleton-text w-20" />
            </th>
            <th className="text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
              <div className="skeleton-text w-16" />
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <FileRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }
}

function getFileIcon(file: FileMetadata): string {
  if (file.isFolder) return '📁'

  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const iconMap: Record<string, string> = {
    // Documents
    pdf: '📄',
    doc: '📝',
    docx: '📝',
    txt: '📃',
    md: '📋',
    // Spreadsheets
    xls: '📊',
    xlsx: '📊',
    csv: '📊',
    // Presentations
    ppt: '📽️',
    pptx: '📽️',
    // Images
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    svg: '🖼️',
    webp: '🖼️',
    // Video
    mp4: '🎬',
    mov: '🎬',
    avi: '🎬',
    mkv: '🎬',
    // Audio
    mp3: '🎵',
    wav: '🎵',
    flac: '🎵',
    // Code
    js: '💻',
    ts: '💻',
    py: '💻',
    java: '💻',
    html: '💻',
    css: '💻',
    json: '💻',
    // Archives
    zip: '📦',
    rar: '📦',
    '7z': '📦',
    tar: '📦',
    gz: '📦',
    // Default
    default: '📄'
  }

  return iconMap[ext] || iconMap.default
}

export default function FileTable({
  files,
  loading = false,
  onFileSelect,
  onFileOpen,
  selectedFiles = new Set(),
  onSort,
  sortColumn = 'name',
  sortDirection = 'asc'
}: FileTableProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set(selectedFiles))
  const lastClickRef = useRef<{ id: string; time: number } | null>(null)
  const DOUBLE_CLICK_DELAY = 300

  // Handle click vs double-click
  const handleRowClick = useCallback((file: FileMetadata) => {
    const now = Date.now()
    const lastClick = lastClickRef.current

    if (lastClick && lastClick.id === file.id && (now - lastClick.time) < DOUBLE_CLICK_DELAY) {
      // Double click - open file
      onFileOpen?.(file)
      lastClickRef.current = null
    } else {
      // Single click - select file
      onFileSelect?.(file)
      lastClickRef.current = { id: file.id, time: now }
    }
  }, [onFileSelect, onFileOpen])

  // Handle keyboard navigation (Enter to open)
  const handleRowKeyDown = useCallback((file: FileMetadata, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onFileOpen?.(file)
    }
  }, [onFileOpen])

  const sortedFiles = useMemo(() => {
    if (!files.length) return files

    return [...files].sort((a, b) => {
      // Folders always first
      if (a.isFolder && !b.isFolder) return -1
      if (!a.isFolder && b.isFolder) return 1

      let comparison = 0
      switch (sortColumn) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'modifiedTime':
          comparison = new Date(a.modifiedTime).getTime() - new Date(b.modifiedTime).getTime()
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [files, sortColumn, sortDirection])

  const handleSort = (column: 'name' | 'size' | 'modifiedTime') => {
    if (!onSort) return
    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc'
    onSort(column, newDirection)
  }

  const handleCheckboxChange = (file: FileMetadata, checked: boolean) => {
    const newSelected = new Set(localSelected)
    if (checked) {
      newSelected.add(file.id)
    } else {
      newSelected.delete(file.id)
    }
    setLocalSelected(newSelected)
    // Call with just file for simple selection
    onFileSelect?.(file)
  }

  const allSelected = files.length > 0 && files.every(f => localSelected.has(f.id))
  const someSelected = files.some(f => localSelected.has(f.id)) && !allSelected

  const handleSelectAll = () => {
    if (allSelected) {
      setLocalSelected(new Set())
      // Clear selection - just call once with each file
      files.forEach(f => {
        if (localSelected.has(f.id)) {
          onFileSelect?.(f)
        }
      })
    } else {
      const allIds = new Set(files.map(f => f.id))
      setLocalSelected(allIds)
      // Select all - just call once with each file
      files.forEach(f => onFileSelect?.(f))
    }
  }

  const SortIcon = ({ column }: { column: 'name' | 'size' | 'modifiedTime' }) => {
    if (sortColumn !== column) return null
    return (
      <span className="ml-1 inline-block">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  if (loading) {
    return <TableSkeleton />
  }

  if (!files.length) {
    return (
      <div className="file-table-empty">
        <div className="empty-icon">📂</div>
        <p className="empty-title">No files</p>
        <p className="empty-subtitle">Upload files or select a folder to get started</p>
      </div>
    )
  }

  return (
    <div className="file-table-container">
      <table className="file-table">
        <thead>
          <tr className="file-table-header">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => {
                  if (el) el.indeterminate = someSelected
                }}
                onChange={handleSelectAll}
                className="file-checkbox"
              />
            </th>
            <th
              className="text-left py-3 px-4 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
              onClick={() => handleSort('name')}
            >
              <span className="flex items-center gap-1">
                Name
                <SortIcon column="name" />
              </span>
            </th>
            <th
              className="text-left py-3 px-4 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 w-24"
              onClick={() => handleSort('size')}
            >
              <span className="flex items-center gap-1">
                Size
                <SortIcon column="size" />
              </span>
            </th>
            <th
              className="text-left py-3 px-4 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 w-32"
              onClick={() => handleSort('modifiedTime')}
            >
              <span className="flex items-center gap-1">
                Modified
                <SortIcon column="modifiedTime" />
              </span>
            </th>
            <th className="text-left py-3 px-4 w-20">Provider</th>
          </tr>
        </thead>
        <tbody>
          {sortedFiles.map((file, index) => (
            <tr
              key={file.id}
              className={`
                file-row
                ${index !== sortedFiles.length - 1 ? 'file-row-separator' : ''}
                ${hoveredRow === file.id ? 'file-row-hover' : ''}
                ${localSelected.has(file.id) ? 'file-row-selected' : ''}
              `}
              onMouseEnter={() => setHoveredRow(file.id)}
              onMouseLeave={() => setHoveredRow(null)}
              onClick={() => handleRowClick(file)}
              onDoubleClick={() => onFileOpen?.(file)}
              onKeyDown={(e) => handleRowKeyDown(file, e)}
              tabIndex={0}
            >
              <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={localSelected.has(file.id)}
                  onChange={e => handleCheckboxChange(file, e.target.checked)}
                  className="file-checkbox"
                />
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <span className="file-icon">{getFileIcon(file)}</span>
                  <span className="file-name truncate" title={file.name}>
                    {file.name}
                  </span>
                  {file.shareLink && (
                    <span className="file-shared-badge" title="Shared">
                      🔗
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4 text-gray-500 text-sm">
                {file.isFolder ? '—' : formatBytes(file.size)}
              </td>
              <td className="py-3 px-4 text-gray-500 text-sm">
                {formatDate(file.modifiedTime)}
              </td>
              <td className="py-3 px-4">
                <span className="provider-badge" title={file.providerName}>
                  {file.provider}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
