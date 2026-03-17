'use client'

import { Button } from '@/components/ui/Button'

interface SelectionToolbarProps {
  selectedFiles: any[]
  onOpen: (file: any) => void
  onDownload: (files: any[]) => void
  onRename: (file: any) => void
  onMove: (files: any[]) => void
  onCopy: (files: any[]) => void
  onDelete: (files: any[]) => void
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
      className="fixed bottom-8 left-1/2 z-[100] flex w-[min(92vw,960px)] -translate-x-1/2 items-center justify-between gap-4 rounded-3xl px-4 py-3 animate-fade-in animate-slide-in-up"
      style={{ 
        backgroundColor: 'var(--cf-menu-bg)',
        boxShadow: 'var(--shadow-strong)',
        border: '1px solid var(--border-subtle)'
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onClearSelection} title="Clear selection">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
        <div className="min-w-0">
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Selected</div>
          <div className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {count} item{count !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {isSingle && (
          <>
            <ToolbarButton label="Open" onClick={() => onOpen(firstFile)} />
            <ToolbarButton label="Rename" onClick={() => onRename(firstFile)} />
          </>
        )}

        <ToolbarButton label="Download" onClick={() => onDownload(selectedFiles)} />
        <ToolbarButton label="Move" onClick={() => onMove(selectedFiles)} />
        <ToolbarButton label="Copy" onClick={() => onCopy(selectedFiles)} />

        <Button
          variant="ghost"
          onClick={() => onDelete(selectedFiles)}
          className="gap-2"
          style={{ color: 'var(--accent-red)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="font-mono text-xs font-bold uppercase tracking-wider">Delete</span>
        </Button>
      </div>
    </div>
  )
}

function ToolbarButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" onClick={onClick} className="gap-2">
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </Button>
  )
}
