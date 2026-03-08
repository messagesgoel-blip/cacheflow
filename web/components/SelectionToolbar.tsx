'use client'

import { FileMetadata, PROVIDERS } from '@/lib/providers/types'

interface SelectionToolbarProps {
  selectedFiles: FileMetadata[]
  onOpen: (file: FileMetadata) => void
  onDownload: (files: FileMetadata[]) => void
  onRename: (file: FileMetadata) => void
  onMove: (files: FileMetadata[]) => void
  onCopy: (files: FileMetadata[]) => void
  onDelete: (files: FileMetadata[]) => void
  onClearSelection: () => void
}

export default function SelectionToolbar({
  selectedFiles,
  onOpen,
  onDownload,
  onRename,
  onMove,
  onCopy,
  onDelete,
  onClearSelection,
}: SelectionToolbarProps) {
  const count = selectedFiles.length
  if (count === 0) return null

  const isSingle = count === 1
  const firstFile = selectedFiles[0]

  return (
    <div
      data-testid="cf-selection-toolbar"
      className="fixed bottom-8 left-1/2 z-[100] flex w-[min(92vw,960px)] -translate-x-1/2 items-center justify-between gap-4 rounded-[24px] border border-[var(--cf-border-2)] bg-[var(--cf-menu-bg)] px-4 py-3 text-[var(--cf-text-0)] shadow-[var(--cf-shadow-strong)] animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onClearSelection}
          className="rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] p-2 transition-colors hover:bg-[var(--cf-hover-bg-strong)]"
          title="Clear selection"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="min-w-0">
          <div className="cf-micro-label">Selection Surface</div>
          <div className="truncate text-sm font-semibold text-[var(--cf-text-0)]">
            {count} item{count !== 1 ? 's' : ''} selected
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1">
        {isSingle && (
          <>
            <ToolbarButton
              label="Open"
              onClick={() => onOpen(firstFile)}
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
            />
            <ToolbarButton
              label="Rename"
              onClick={() => onRename(firstFile)}
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />}
            />
          </>
        )}

        <ToolbarButton
          label="Download"
          onClick={() => onDownload(selectedFiles)}
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />}
        />

        <ToolbarButton
          label="Move"
          onClick={() => onMove(selectedFiles)}
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />}
        />

        <ToolbarButton
          label="Copy"
          onClick={() => onCopy(selectedFiles)}
          icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />}
        />

        <div className="mx-1 hidden h-6 w-px bg-[var(--cf-border)] md:block" />

        <button
          onClick={() => onDelete(selectedFiles)}
          className="flex items-center gap-2 rounded-xl border border-[rgba(255,92,92,0.24)] bg-[rgba(255,92,92,0.08)] px-3 py-2 text-[var(--cf-red)] transition-colors hover:bg-[rgba(255,92,92,0.12)]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]">Delete</span>
        </button>
      </div>
    </div>
  )
}

function ToolbarButton({ label, onClick, icon }: { label: string, onClick: () => void, icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2 rounded-xl border border-[var(--cf-border)] bg-[var(--cf-panel-soft)] px-3 py-2 transition-colors hover:border-[rgba(74,158,255,0.18)] hover:bg-[var(--cf-hover-bg-strong)]"
    >
      <svg className="w-5 h-5 opacity-80 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {icon}
      </svg>
      <span className="text-sm font-semibold text-[var(--cf-text-1)] opacity-90 group-hover:text-[var(--cf-text-0)]">{label}</span>
    </button>
  )
}
