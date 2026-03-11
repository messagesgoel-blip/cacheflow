'use client'

import { FileMetadata, PROVIDERS, formatBytes } from '@/lib/providers/types'
import { getFileIcon } from './UnifiedFileBrowser'
import type { PreviewType } from '@/lib/files/previewUtils'

interface PreviewPanelProps {
  file: FileMetadata
  url: string | null
  type: PreviewType
  textContent?: string
  previewLoading?: boolean
  previewError?: string
  onClose: () => void
  onDownload: (file: FileMetadata) => void
  onRename: (file: FileMetadata) => void
  onMove: (file: FileMetadata) => void
  onCopy: (file: FileMetadata) => void
  onDelete: (file: FileMetadata) => void
}

function buildMediaStreamUrl(file: FileMetadata): string | null {
  const accountKey = String((file as any).accountKey || '')
  const fileId = file.id
  const provider = file.provider

  if (provider === 'vps' && accountKey) {
    return `/api/providers/vps/${encodeURIComponent(accountKey)}/files/download?path=${encodeURIComponent(fileId)}`
  }

  if (provider === 'local') {
    return `/api/files/download?id=${encodeURIComponent(fileId)}`
  }

  if (accountKey) {
    return `/api/remotes/${encodeURIComponent(accountKey)}/upload?fileId=${encodeURIComponent(fileId)}&provider=${encodeURIComponent(provider)}`
  }

  return null
}

export default function PreviewPanel({
  file,
  url,
  type,
  textContent,
  previewLoading,
  previewError,
  onClose,
  onDownload,
  onRename,
  onMove,
  onCopy,
  onDelete
}: PreviewPanelProps) {
  const provider = PROVIDERS.find(p => p.id === file.provider)
  const canActOnFile = Boolean(file?.id && file?.name)
  const actionDisabledClass = 'opacity-50 cursor-not-allowed'

  const mediaStreamUrl = type === 'video' || type === 'audio' 
    ? buildMediaStreamUrl(file) || url 
    : null

  return (
    <div 
      data-testid="cf-preview-panel"
      className="cf-liquid z-20 flex h-full w-80 flex-col animate-in slide-in-from-right rounded-l-[30px] border-l-0 bg-[var(--cf-shell-card-strong)] shadow-[var(--cf-shadow-strong)] duration-300 md:w-96"
    >
      {/* Header */}
      <div className="cf-toolbar-card flex items-center justify-between border-b border-[var(--cf-border)] p-4">
        <h3 className="truncate pr-4 text-base font-bold tracking-[-0.03em] text-[var(--cf-text-0)]">File Details</h3>
        <button 
          data-testid="cf-preview-close"
          onClick={onClose}
          className="rounded-2xl p-2 text-[var(--cf-text-2)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Preview Area */}
      <div className="flex aspect-square items-center justify-center overflow-hidden border-b border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)]">
        {previewError ? (
          <div className="flex flex-col items-center gap-2 text-center p-8">
            <span className="text-5xl">⚠️</span>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--cf-red)]">Could not load preview</p>
            <p className="text-xs text-[var(--cf-text-2)]">{previewError}</p>
          </div>
        ) : previewLoading ? (
          <div className="flex flex-col items-center gap-2 text-center p-8">
            <span className="text-5xl animate-pulse">{getFileIcon(file.mimeType)}</span>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--cf-text-2)]">Loading preview</p>
          </div>
        ) : type === 'image' ? (
          <img src={url || undefined} alt={file.name} className="max-w-full max-h-full object-contain" />
        ) : type === 'video' ? (
          <video 
            src={mediaStreamUrl || undefined} 
            controls 
            className="max-w-full max-h-full"
            preload="metadata"
          >
            Your browser does not support video playback.
          </video>
        ) : type === 'audio' ? (
          <div className="flex flex-col items-center gap-4 p-8 w-full">
            <audio 
              src={mediaStreamUrl || undefined} 
              controls 
              className="w-full max-w-xs"
            >
              Your browser does not support audio playback.
            </audio>
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--cf-text-2)]">Audio File</span>
          </div>
        ) : type === 'pdf' ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-6xl">📄</span>
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--cf-text-2)]">PDF Document</span>
          </div>
        ) : type === 'text' ? (
          <div className="w-full h-full overflow-auto p-4 text-left">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--cf-text-1)]">
              {textContent ?? 'Loading text preview…'}
            </pre>
          </div>
        ) : !url ? (
          <div className="text-6xl">{getFileIcon(file.mimeType)}</div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center p-8">
            <span className="text-6xl">{getFileIcon(file.mimeType)}</span>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--cf-text-2)]">Preview not available</p>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div>
          <h4 data-testid="cf-preview-metadata-name" className="break-words text-lg font-bold leading-tight text-[var(--cf-text-0)]">
            {file.name}
          </h4>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg">{provider?.icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--cf-text-2)]">
              {file.providerName || file.provider}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-[var(--cf-border)] pt-6 text-xs">
          <div className="space-y-1">
            <p className="font-bold uppercase tracking-tighter text-[var(--cf-text-3)]">Size</p>
            <p data-testid="cf-preview-metadata-size" className="font-medium text-[var(--cf-text-1)]">{formatBytes(file.size)}</p>
          </div>
          <div className="space-y-1">
            <p className="font-bold uppercase tracking-tighter text-[var(--cf-text-3)]">Type</p>
            <p className="truncate font-medium text-[var(--cf-text-1)]" title={file.mimeType}>{file.mimeType.split('/').pop()?.toUpperCase() || 'FILE'}</p>
          </div>
          <div className="col-span-2 space-y-1">
            <p className="font-bold uppercase tracking-tighter text-[var(--cf-text-3)]">Modified</p>
            <p data-testid="cf-preview-metadata-modified" className="font-medium text-[var(--cf-text-1)]">{new Date(file.modifiedTime).toLocaleString()}</p>
          </div>
          <div className="col-span-2 space-y-1">
            <p className="font-bold uppercase tracking-tighter text-[var(--cf-text-3)]">Path</p>
            <p className="break-all font-mono text-[10px] font-medium text-[var(--cf-text-2)]">
              {file.pathDisplay || file.path}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--cf-border)] pt-6">
          <button 
            data-testid="cf-preview-action-download"
            onClick={() => canActOnFile && onDownload(file)}
            disabled={!canActOnFile}
            title={!canActOnFile ? 'File details loading...' : undefined}
            className={`col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-[rgba(116,174,252,0.26)] bg-[rgba(116,174,252,0.16)] py-2.5 text-xs font-bold text-[var(--cf-blue)] transition-colors hover:bg-[rgba(116,174,252,0.22)] ${!canActOnFile ? actionDisabledClass : ''}`}
          >
            Download File
          </button>
          <button 
            data-testid="cf-preview-action-rename"
            onClick={() => canActOnFile && onRename(file)}
            disabled={!canActOnFile}
            title={!canActOnFile ? 'File details loading...' : undefined}
            className={`flex items-center justify-center gap-2 rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] py-2 text-xs font-medium text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)] ${!canActOnFile ? actionDisabledClass : ''}`}
          >
            Rename
          </button>
          <button 
            data-testid="cf-preview-action-move"
            onClick={() => canActOnFile && onMove(file)}
            disabled={!canActOnFile}
            title={!canActOnFile ? 'File details loading...' : undefined}
            className={`flex items-center justify-center gap-2 rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] py-2 text-xs font-medium text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)] ${!canActOnFile ? actionDisabledClass : ''}`}
          >
            Move
          </button>
          <button 
            data-testid="cf-preview-action-copy"
            onClick={() => canActOnFile && onCopy(file)}
            disabled={!canActOnFile}
            title={!canActOnFile ? 'File details loading...' : undefined}
            className={`flex items-center justify-center gap-2 rounded-2xl border border-[var(--cf-border)] bg-[rgba(255,255,255,0.03)] py-2 text-xs font-medium text-[var(--cf-text-1)] hover:bg-[var(--cf-hover-bg)] hover:text-[var(--cf-text-0)] ${!canActOnFile ? actionDisabledClass : ''}`}
          >
            Copy
          </button>
          <button 
            data-testid="cf-preview-action-delete"
            onClick={() => canActOnFile && onDelete(file)}
            disabled={!canActOnFile}
            title={!canActOnFile ? 'File details loading...' : undefined}
            className={`flex items-center justify-center gap-2 rounded-2xl border border-[rgba(255,92,92,0.22)] bg-[rgba(255,92,92,0.08)] py-2 text-xs font-medium text-[var(--cf-red)] hover:bg-[rgba(255,92,92,0.12)] ${!canActOnFile ? actionDisabledClass : ''}`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
