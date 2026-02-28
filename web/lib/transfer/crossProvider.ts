import { StorageProvider } from '../providers/StorageProvider'
import { FileMetadata } from '../providers/types'

export interface CrossProviderTransferOptions {
  source: StorageProvider
  target: StorageProvider
  file: FileMetadata
  targetFolderId: string
  mode: 'copy' | 'move'
}

/**
 * Copy or move a file between providers by downloading then uploading.
 * If mode is "move", source file is deleted after upload.
 */
export async function transferFileBetweenProviders(options: CrossProviderTransferOptions): Promise<FileMetadata> {
  const { source, target, file, targetFolderId, mode } = options

  // Download from source
  const blob = await source.downloadFile(file.id)
  const uploadFile = new File([blob], file.name, { type: file.mimeType || 'application/octet-stream' })

  // Upload to target
  const uploaded = await target.uploadFile(uploadFile, { folderId: targetFolderId, fileName: file.name })

  // If move, delete from source
  if (mode === 'move') {
    await source.deleteFile(file.id)
  }

  return uploaded
}
