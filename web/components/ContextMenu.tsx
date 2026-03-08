'use client'

import { useState, useEffect, useRef } from 'react'

interface ContextMenuItem {
  label: string
  icon?: string
  action: () => void
  disabled?: boolean
  danger?: boolean
  separator?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    // Close on escape key
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

  // Adjust position if menu would go off-screen
  const [adjustedPosition, setAdjustedPosition] = useState({ x, y })

  useEffect(() => {
    if (!menuRef.current) return

    const menuWidth = 200
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

    setAdjustedPosition({ x: adjustedX, y: adjustedY })
  }, [x, y])

  function handleItemClick(item: ContextMenuItem) {
    if (!item.disabled) {
      item.action()
      onClose()
    }
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      {items.map((item, index) => (
        <div key={index}>
          {item.separator ? (
            <div className="border-t my-1"></div>
          ) : (
            <button
              onClick={() => handleItemClick(item)}
              disabled={item.disabled}
              className={`
                w-full text-left px-4 py-2 text-sm
                ${item.disabled
                  ? 'text-gray-400 cursor-not-allowed'
                  : item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-100'
                }
                flex items-center gap-2
              `}
            >
              {item.icon && <span>{item.icon}</span>}
              {item.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// Hook for using context menu
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    items: ContextMenuItem[]
  } | null>(null)

  function showContextMenu(x: number, y: number, items: ContextMenuItem[]) {
    setContextMenu({ x, y, items })
  }

  function hideContextMenu() {
    setContextMenu(null)
  }

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
    ContextMenuComponent: contextMenu ? (
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenu.items}
        onClose={hideContextMenu}
      />
    ) : null
  }
}

// Predefined context menu items for common actions
export const contextMenuItems = {
  file: (file: any, actions: {
    onDownload?: () => void
    onShare?: () => void
    onRename?: () => void
    onMove?: () => void
    onDelete?: () => void
    onRetry?: () => void
  }) => {
    const items: ContextMenuItem[] = []

    if (actions.onDownload && file.status === 'synced') {
      items.push({
        label: 'Download',
        icon: '⬇️',
        action: actions.onDownload
      })
    }

    if (actions.onShare && (file.status === 'synced' || file.status === 'pending')) {
      items.push({
        label: 'Share',
        icon: '🔗',
        action: actions.onShare
      })
    }

    if (actions.onRename) {
      items.push({
        label: 'Rename',
        icon: '✏️',
        action: actions.onRename
      })
    }

    if (actions.onMove) {
      items.push({
        label: 'Move',
        icon: '📂',
        action: actions.onMove
      })
    }

    if (actions.onRetry && file.status === 'error') {
      items.push({
        label: 'Retry Sync',
        icon: '🔄',
        action: actions.onRetry
      })
    }

    if (items.length > 0) {
      items.push({ separator: true } as any)
    }

    if (actions.onDelete) {
      const isLocked = file.immutable_until && new Date(file.immutable_until) > new Date()
      items.push({
        label: isLocked ? 'Locked' : 'Delete',
        icon: isLocked ? '🔒' : '🗑️',
        action: actions.onDelete,
        disabled: isLocked,
        danger: !isLocked
      })
    }

    return items
  },

  folder: (folder: any, actions: {
    onOpen?: () => void
    onRename?: () => void
    onDelete?: () => void
    onUpload?: () => void
    onCreateFolder?: () => void
  }) => {
    const items: ContextMenuItem[] = []

    if (actions.onOpen) {
      items.push({
        label: 'Open',
        icon: '📂',
        action: actions.onOpen
      })
    }

    if (actions.onUpload) {
      items.push({
        label: 'Upload Here',
        icon: '⬆️',
        action: actions.onUpload
      })
    }

    if (actions.onCreateFolder) {
      items.push({
        label: 'New Folder',
        icon: '📁',
        action: actions.onCreateFolder
      })
    }

    if (items.length > 0) {
      items.push({ separator: true } as any)
    }

    if (actions.onRename) {
      items.push({
        label: 'Rename',
        icon: '✏️',
        action: actions.onRename
      })
    }

    if (actions.onDelete) {
      items.push({
        label: 'Delete',
        icon: '🗑️',
        action: actions.onDelete,
        danger: true
      })
    }

    return items
  },

  emptySpace: (actions: {
    onUpload?: () => void
    onCreateFolder?: () => void
    onRefresh?: () => void
  }) => {
    const items: ContextMenuItem[] = []

    if (actions.onUpload) {
      items.push({
        label: 'Upload File',
        icon: '⬆️',
        action: actions.onUpload
      })
    }

    if (actions.onCreateFolder) {
      items.push({
        label: 'New Folder',
        icon: '📁',
        action: actions.onCreateFolder
      })
    }

    if (actions.onRefresh) {
      items.push({
        label: 'Refresh',
        icon: '🔄',
        action: actions.onRefresh
      })
    }

    return items
  }
}
