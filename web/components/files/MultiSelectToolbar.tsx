'use client'

import { FileMetadata } from '@/lib/providers/types'

// Multi-select action handlers
export interface MultiSelectActions {
  onOpen?: (file: FileMetadata) => void
  onDownload?: (files: FileMetadata[]) => void
  onRename?: (file: FileMetadata) => void
  onMove?: (files: FileMetadata[]) => void
  onCopy?: (files: FileMetadata[]) => void
  onDelete?: (files: FileMetadata[]) => void
  onClearSelection: () => void
}

interface MultiSelectToolbarProps {
  selectedFiles: FileMetadata[]
  actions: MultiSelectActions
}

// Icon components for the toolbar
const OpenIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const RenameIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const MoveIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
)

const CopyIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

const DeleteIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export default function MultiSelectToolbar({
  selectedFiles,
  actions
}: MultiSelectToolbarProps) {
  const count = selectedFiles.length

  // Don't render if no files selected
  if (count === 0) return null

  const isSingle = count === 1
  const firstFile = selectedFiles[0]

  return (
    <div
      data-testid="cf-multi-select-toolbar"
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 dark:bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      {/* Selection count and clear button */}
      <div className="flex items-center gap-3 pr-6 border-r border-white/20">
        <button
          onClick={actions.onClearSelection}
          className="p-1 hover:bg-white/10 rounded-full transition-colors"
          title="Clear selection"
          aria-label="Clear selection"
        >
          <CloseIcon />
        </button>
        <span className="font-medium whitespace-nowrap">
          {count} item{count !== 1 ? 's' : ''} selected
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Open - only for single selection and folders */}
        {isSingle && firstFile.isFolder && actions.onOpen && (
          <ToolbarButton
            label="Open"
            onClick={() => actions.onOpen!(firstFile)}
            icon={<OpenIcon />}
          />
        )}

        {/* Rename - only for single selection */}
        {isSingle && actions.onRename && (
          <ToolbarButton
            label="Rename"
            onClick={() => actions.onRename!(firstFile)}
            icon={<RenameIcon />}
          />
        )}

        {/* Download - for single or multiple */}
        {actions.onDownload && (
          <ToolbarButton
            label="Download"
            onClick={() => actions.onDownload!(selectedFiles)}
            icon={<DownloadIcon />}
          />
        )}

        {/* Move */}
        {actions.onMove && (
          <ToolbarButton
            label="Move"
            onClick={() => actions.onMove!(selectedFiles)}
            icon={<MoveIcon />}
          />
        )}

        {/* Copy */}
        {actions.onCopy && (
          <ToolbarButton
            label="Copy"
            onClick={() => actions.onCopy!(selectedFiles)}
            icon={<CopyIcon />}
          />
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-white/20 mx-2" />

        {/* Delete */}
        {actions.onDelete && (
          <button
            onClick={() => actions.onDelete!(selectedFiles)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-red-500 transition-colors text-red-200 hover:text-white"
            aria-label="Delete selected items"
          >
            <DeleteIcon />
            <span className="text-sm font-medium">Delete</span>
          </button>
        )}
      </div>
    </div>
  )
}

// Toolbar button sub-component
interface ToolbarButtonProps {
  label: string
  onClick: () => void
  icon: React.ReactNode
}

function ToolbarButton({ label, onClick, icon }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg hover:bg-white/10 transition-colors group"
      aria-label={label}
    >
      <span className="opacity-80 group-hover:opacity-100">
        {icon}
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wider opacity-70 group-hover:opacity-100">
        {label}
      </span>
    </button>
  )
}

export { MultiSelectToolbar, ToolbarButton }

