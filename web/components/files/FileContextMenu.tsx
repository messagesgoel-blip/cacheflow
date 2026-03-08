'use client'

import { useState, useRef, useEffect } from 'react'
import { FileMetadata } from '@/lib/providers/types'

// File action types based on UI-P1-T04 contract
export interface FileActions {
  onOpen?: (file: FileMetadata) => void
  onDownload?: (file: FileMetadata) => void
  onRename?: (file: FileMetadata) => void
  onMove?: (file: FileMetadata) => void
  onCopy?: (file: FileMetadata) => void
  onDelete?: (file: FileMetadata) => void
  onToggleFavorite?: (file: FileMetadata) => void
  onShare?: (file: FileMetadata) => void
}

interface MenuItemConfig {
  id: string
  label: string
  icon: string
  danger?: boolean
  requiresFolder?: boolean
  requiresFile?: boolean
  requiresSync?: boolean
  separatorAfter?: boolean
}

// Standard file actions menu items - identical for both row menu and context menu
const MENU_ITEMS: MenuItemConfig[] = [
  { id: 'open', label: 'Open', icon: '👁️', requiresFolder: true },
  { id: 'download', label: 'Download', icon: '⬇️', requiresFile: true, requiresSync: true },
  { id: 'share', label: 'Share', icon: '🔗', requiresFile: true },
  { id: 'separator-1', label: '', icon: '', separatorAfter: true },
  { id: 'rename', label: 'Rename', icon: '✏️' },
  { id: 'move', label: 'Move', icon: '📦' },
  { id: 'copy', label: 'Copy', icon: '📄' },
  { id: 'separator-2', label: '', icon: '', separatorAfter: true },
  { id: 'delete', label: 'Delete', icon: '🗑️', danger: true },
]

// =============================================================================
// Row Menu Component (Three-dot kebab menu)
// =============================================================================

interface FileRowMenuProps {
  file: FileMetadata
  actions: FileActions
  isFavorite?: boolean
  isFavoriting?: boolean
}

export function FileRowMenu({ file, actions, isFavorite, isFavoriting }: FileRowMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleAction = (item: MenuItemConfig) => {
    setIsOpen(false)
    switch (item.id) {
      case 'open':
        actions.onOpen?.(file)
        break
      case 'download':
        actions.onDownload?.(file)
        break
      case 'share':
        actions.onShare?.(file)
        break
      case 'rename':
        actions.onRename?.(file)
        break
      case 'move':
        actions.onMove?.(file)
        break
      case 'copy':
        actions.onCopy?.(file)
        break
      case 'delete':
        actions.onDelete?.(file)
        break
    }
  }

  const isItemVisible = (item: MenuItemConfig): boolean => {
    if (item.requiresFolder && !file.isFolder) return false
    if (item.requiresFile && file.isFolder) return false
    // Download only for synced files (status check would need to be passed in)
    return true
  }

  const visibleItems = MENU_ITEMS.filter(isItemVisible)

  return (
    <div className="relative" ref={menuRef}>
      <button
        data-testid="cf-files-row-overflow"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setIsOpen(!isOpen)
        }}
        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-400 transition-all font-bold"
        aria-label="File actions"
        aria-expanded={isOpen}
      >
        •••
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown menu */}
          <div className="absolute right-4 top-full z-20 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl py-2 animate-in fade-in zoom-in-95 duration-100">
            {visibleItems.map((item, idx) => (
              item.id.startsWith('separator') ? (
                <div key={item.id} className="my-1 border-t border-gray-100 dark:border-gray-800" />
              ) : (
                <button
                  key={item.id}
                  onClick={() => handleAction(item)}
                  className={`
                    w-full px-4 py-2 text-left text-xs font-bold flex items-center gap-3
                    ${item.danger
                      ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              )
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// =============================================================================
// Context Menu Component (Right-click menu)
// =============================================================================

interface FileContextMenuProps {
  x: number
  y: number
  file: FileMetadata
  actions: FileActions
  onClose: () => void
}

export function FileContextMenu({ x, y, file, actions, onClose }: FileContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x, y })

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current) return

    const menuWidth = 192 // w-48 = 192px
    const menuHeight = menuRef.current.offsetHeight
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    let adjustedX = x
    let adjustedY = y

    // Adjust horizontally
    if (x + menuWidth > windowWidth) {
      adjustedX = windowWidth - menuWidth - 10
    }

    // Adjust vertically
    if (y + menuHeight > windowHeight) {
      adjustedY = windowHeight - menuHeight - 10
    }

    setPosition({ x: adjustedX, y: adjustedY })
  }, [x, y])

  // Close on outside click and escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleAction = (item: MenuItemConfig) => {
    switch (item.id) {
      case 'open':
        actions.onOpen?.(file)
        break
      case 'download':
        actions.onDownload?.(file)
        break
      case 'share':
        actions.onShare?.(file)
        break
      case 'rename':
        actions.onRename?.(file)
        break
      case 'move':
        actions.onMove?.(file)
        break
      case 'copy':
        actions.onCopy?.(file)
        break
      case 'delete':
        actions.onDelete?.(file)
        break
    }
    onClose()
  }

  const isItemVisible = (item: MenuItemConfig): boolean => {
    if (item.requiresFolder && !file.isFolder) return false
    if (item.requiresFile && file.isFolder) return false
    return true
  }

  const visibleItems = MENU_ITEMS.filter(isItemVisible)

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl py-2 min-w-[192px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {visibleItems.map((item) => (
        item.id.startsWith('separator') ? (
          <div key={item.id} className="my-1 border-t border-gray-100 dark:border-gray-800" />
        ) : (
          <button
            key={item.id}
            onClick={() => handleAction(item)}
            className={`
              w-full px-4 py-2 text-left text-xs font-bold flex items-center gap-3
              ${item.danger
                ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }
            `}
          >
            <span>{item.icon}</span>
            {item.label}
          </button>
        )
      ))}
    </div>
  )
}

// =============================================================================
// Hook for using file context menu (right-click)
// =============================================================================

export function useFileContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    file: FileMetadata
    actions: FileActions
  } | null>(null)

  const showContextMenu = (e: React.MouseEvent, file: FileMetadata, actions: FileActions) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      file,
      actions
    })
  }

  const hideContextMenu = () => {
    setContextMenu(null)
  }

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
    ContextMenuComponent: contextMenu ? (
      <FileContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        file={contextMenu.file}
        actions={contextMenu.actions}
        onClose={hideContextMenu}
      />
    ) : null
  }
}

export default FileContextMenu

