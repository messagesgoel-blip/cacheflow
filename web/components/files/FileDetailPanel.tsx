'use client'

import { FileMetadata, PROVIDERS, formatBytes } from '@/lib/providers/types'

interface FileDetailPanelProps {
  file: FileMetadata | null
  onClose: () => void
  onOpen?: (file: FileMetadata) => void
  onDownload?: (file: FileMetadata) => void
  onRename?: (file: FileMetadata) => void
  onMove?: (file: FileMetadata) => void
  onCopy?: (file: FileMetadata) => void
  onDelete?: (file: FileMetadata) => void
}

// Get file icon based on mime type
function getFileIcon(mimeType: string, isFolder: boolean): string {
  if (isFolder) return '📁'
  if (mimeType?.startsWith('image/')) return '🖼️'
  if (mimeType?.startsWith('video/')) return '🎬'
  if (mimeType?.startsWith('audio/')) return '🎵'
  if (mimeType?.includes('pdf')) return '📄'
  if (mimeType?.includes('zip') || mimeType?.includes('archive')) return '📦'
  if (mimeType?.includes('word') || mimeType?.includes('document')) return '📝'
  if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) return '📊'
  if (mimeType?.includes('presentation')) return '📽️'
  if (mimeType?.includes('text')) return '📃'
  return '📄'
}

export default function FileDetailPanel({
  file,
  onClose,
  onOpen,
  onDownload,
  onRename,
  onMove,
  onCopy,
  onDelete
}: FileDetailPanelProps) {
  if (!file) {
    return (
      <div className="w-80 md:w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white">File Details</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a file to view details
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Single click to select, double click to open
          </p>
        </div>
      </div>
    )
  }

  const provider = PROVIDERS.find(p => p.id === file.provider)

  return (
    <div className="w-80 md:w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full animate-in slide-in-from-right duration-300 shadow-2xl z-20">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h3 className="font-bold text-gray-900 dark:text-white truncate pr-4">File Details</h3>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-500"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* File Icon Preview Area */}
      <div className="aspect-square bg-gray-50 dark:bg-gray-950 flex items-center justify-center overflow-hidden border-b border-gray-100 dark:border-gray-800">
        <div className="text-7xl">{getFileIcon(file.mimeType, file.isFolder)}</div>
      </div>

      {/* Metadata */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* File name */}
        <div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white break-words leading-tight">
            {file.name}
          </h4>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg">{provider?.icon}</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {file.providerName || file.provider}
            </span>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-4 border-t border-gray-100 dark:border-gray-800 pt-6 text-xs">
          <div className="space-y-1">
            <p className="text-gray-400 font-bold uppercase tracking-tighter">Size</p>
            <p className="font-medium">{file.isFolder ? '—' : formatBytes(file.size)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-gray-400 font-bold uppercase tracking-tighter">Type</p>
            <p className="font-medium truncate" title={file.mimeType}>
              {file.isFolder ? 'Folder' : (file.mimeType.split('/').pop()?.toUpperCase() || 'FILE')}
            </p>
          </div>
          <div className="col-span-2 space-y-1">
            <p className="text-gray-400 font-bold uppercase tracking-tighter">Modified</p>
            <p className="font-medium">
              {file.modifiedTime ? new Date(file.modifiedTime).toLocaleString() : '—'}
            </p>
          </div>
          {file.createdTime && (
            <div className="col-span-2 space-y-1">
              <p className="text-gray-400 font-bold uppercase tracking-tighter">Created</p>
              <p className="font-medium">{new Date(file.createdTime).toLocaleString()}</p>
            </div>
          )}
          <div className="col-span-2 space-y-1">
            <p className="text-gray-400 font-bold uppercase tracking-tighter">Path</p>
            <p className="font-medium break-all text-gray-500 dark:text-gray-400 font-mono text-[10px]">
              {file.pathDisplay || file.path}
            </p>
          </div>
          {file.webUrl && (
            <div className="col-span-2 space-y-1">
              <p className="text-gray-400 font-bold uppercase tracking-tighter">Web URL</p>
              <a
                href={file.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-500 hover:text-blue-600 truncate block"
              >
                Open in {provider?.name}
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-6 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-2">
          {!file.isFolder && onDownload && (
            <button
              onClick={() => onDownload(file)}
              className="flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-shadow shadow-md hover:shadow-lg col-span-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          )}
          {onOpen && (
            <button
              onClick={() => onOpen(file)}
              className="flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Open
            </button>
          )}
          {onRename && (
            <button
              onClick={() => onRename(file)}
              className="flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Rename
            </button>
          )}
          {onMove && (
            <button
              onClick={() => onMove(file)}
              className="flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Move
            </button>
          )}
          {onCopy && (
            <button
              onClick={() => onCopy(file)}
              className="flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-xs font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(file)}
              className="flex items-center justify-center gap-2 py-2 border border-red-100 dark:border-red-900/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl text-xs font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

