import { StorageProvider } from '../providers/StorageProvider'
import { FileMetadata } from '../providers/types'

export interface CrossProviderTransferOptions {
  source: StorageProvider
  target: StorageProvider
  file: FileMetadata
  targetFolderId: string
  mode: 'copy' | 'move'
  onProgress?: (p: { percent: number; loaded: number; total: number }) => void
}

/**
 * Copy or move a file between providers by downloading then uploading.
 * If mode is "move", source file is deleted after upload.
 */
export async function transferFileBetweenProviders(options: CrossProviderTransferOptions): Promise<FileMetadata> {
  const { source, target, file, targetFolderId, mode, onProgress } = options

  // Download from source (TODO: streaming support for larger files)
  // For now we do a full download to a blob
  const blob = await source.downloadFile(file.id, {
    onProgress: (pct) => {
      // Download phase is 0-50% of the job
      onProgress?.({ percent: pct / 2, loaded: Math.floor(file.size * (pct / 200)), total: file.size })
    }
  })
  
  const uploadFile = new File([blob], file.name, { type: file.mimeType || 'application/octet-stream' })

  // Upload to target
  const uploaded = await target.uploadFile(uploadFile, { 
    folderId: targetFolderId, 
    fileName: file.name,
    onProgress: (pct) => {
      // Upload phase is 50-100% of the job
      onProgress?.({ percent: 50 + (pct / 2), loaded: Math.floor(file.size * (0.5 + pct / 200)), total: file.size })
    }
  })

  // If move, delete from source
  if (mode === 'move') {
    await source.deleteFile(file.id)
  }

  onProgress?.({ percent: 100, loaded: file.size, total: file.size })
  return uploaded
}
