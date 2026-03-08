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

  return (
    <div 
      data-testid="cf-preview-panel"
      className="w-80 md:w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full animate-in slide-in-from-right duration-300 shadow-2xl z-20"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 dark:text-white truncate pr-4">File Details</h3>
        <button 
          data-testid="cf-preview-close"
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Preview Area */}
      <div className="aspect-square bg-gray-50 dark:bg-gray-950 flex items-center justify-center overflow-hidden border-b border-gray-100 dark:border-gray-800">
        {previewError ? (
          <div className="flex flex-col items-center gap-2 text-center p-8">
            <span className="text-5xl">⚠️</span>
            <p className="text-xs text-red-600 uppercase font-bold tracking-widest">Could not load preview</p>
            <p className="text-xs text-gray-500">{previewError}</p>
          </div>
        ) : previewLoading ? (
          <div className="flex flex-col items-center gap-2 text-center p-8">
            <span className="text-5xl animate-pulse">{getFileIcon(file.mimeType)}</span>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Loading preview</p>
          </div>
        ) : type === 'image' ? (
          <img src={url || undefined} alt={file.name} className="max-w-full max-h-full object-contain" />
        ) : type === 'pdf' ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-6xl">📄</span>
            <span className="text-xs text-gray-500 uppercase font-bold tracking-widest">PDF Document</span>
          </div>
        ) : type === 'text' ? (
          <div className="w-full h-full overflow-auto p-4 text-left">
            <pre className="text-xs leading-relaxed font-mono whitespace-pre-wrap break-words text-gray-700 dark:text-gray-200">
              {textContent ?? 'Loading text preview…'}
            </pre>
          </div>
        ) : !url ? (
          <div className="text-6xl">{getFileIcon(file.mimeType)}</div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center p-8">
            <span className="text-6xl">{getFileIcon(file.mimeType)}</span>
            <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Preview not available</p>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h4 data-testid="cf-preview-metadata-name" className="text-lg font-bold text-gray-900 dark:text-white break-words leading-tight">
            {file.name}
          </h4>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg">{provider?.icon}</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {file.providerName || file.provider}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-6 text-xs">
          <div className="space-y-1">
            <p className="text-gray-400 font-bold uppercase tracking-tighter">Size</p>
            <p data-testid="cf-preview-metadata-size" className="font-medium">{formatBytes(file.size)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-400 font-bold uppercase tracking-tighter">Type</p>
            <p className="font-medium truncate" title={file.mimeType}>{file.mimeType.split('/').pop()?.toUpperCase() || 'FILE'}</p>
          </div>
          <div className="col-span-2 space-y-1">
            <p className="text-gray-400 font-bold uppercase tracking-tighter">Modified</p>
            <p data-testid="cf-preview-metadata-modified" className="font-medium">{new Date(file.modifiedTime).toLocaleString()}</p>
          </div>
          <div className="col-span-2 space-y-1">
            <p className="text-gray-400 font-bold uppercase tracking-tighter">Path</p>
            <p className="font-medium break-all text-gray-500 dark:text-gray-400 font-mono text-[10px]">
              {file.pathDisplay || file.path}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-6 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-2">
          <button 
            data-testid="cf-preview-action-download"
            onClick={() => canActOnFile && onDownload(file)}
            disabled={!canActOnFile}
            title={!canActOnFile ? 'File details loading...' : undefined}
            className={`flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-shadow shadow-md hover:shadow-lg col-span-2 ${!canActOnFile ? actionDisabledClass : ''}`}
          >
            Download File
          </button>
          <button 
            data-testid="cf-preview-action-rename"
            onClick={() => canActOnFile && onRename(file)}
            disabled={!canActOnFile}
            title={!canActOnFile ? 'File details loading...' : undefined}
            className={`flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-medium ${!canActOnFile ? actionDisabledClass : ''}`}
          >
            Rename
          </button>
          <button 
            data-testid="cf-preview-action-move"
            onClick={() => canActOnFile && onMove(file)}
            disabled={!canActOnFile}
            title={!canActOnFile ? 'File details loading...' : undefined}
            className={`flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-medium ${!canActOnFile ? actionDisabledClass : ''}`}
          >
            Move
          </button>
          <button 
            data-testid="cf-preview-action-copy"
            onClick={() => canActOnFile && onCopy(file)}
            disabled={!canActOnFile}
            title={!canActOnFile ? 'File details loading...' : undefined}
            className={`flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-medium ${!canActOnFile ? actionDisabledClass : ''}`}
          >
            Copy
          </button>
          <button 
            data-testid="cf-preview-action-delete"
            onClick={() => canActOnFile && onDelete(file)}
            disabled={!canActOnFile}
            title={!canActOnFile ? 'File details loading...' : undefined}
            className={`flex items-center justify-center gap-2 py-2 border border-red-100 dark:border-red-900/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl text-xs font-medium ${!canActOnFile ? actionDisabledClass : ''}`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
