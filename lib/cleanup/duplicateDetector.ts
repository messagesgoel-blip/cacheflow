import { ProviderAdapter } from '../providers/ProviderAdapter.interface';
import { ProviderAuthState, ProviderFile, ProviderId } from '../providers/types';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/ErrorCode';

/**
 * Represents a group of duplicate files that share the same name and size
 */
export interface DuplicateFileGroup {
  /** Normalized signature for this duplicate group (filename|size) */
  signature: string;
  /** The canonical filename for this group */
  fileName: string;
  /** The size that all files in this group share */
  fileSize: number;
  /** List of duplicate files across all providers */
  files: DuplicateFileInfo[];
}

/**
 * Information about a specific duplicate file
 */
export interface DuplicateFileInfo {
  /** Unique file ID from the provider */
  id: string;
  /** Provider this file belongs to */
  providerId: ProviderId;
  /** Name of the file */
  name: string;
  /** Size of the file in bytes */
  size: number;
  /** Parent folder ID (if available) */
  parentId?: string;
  /** Path to the file (if available) */
  path?: string;
  /** MIME type of the file (if available) */
  mimeType?: string;
  /** Modified timestamp (if available) */
  modifiedAt?: string;
  /** Web URL to access the file (if available) */
  webUrl?: string;
}

/**
 * Options for duplicate detection
 */
export interface DuplicateDetectionOptions {
  /** Minimum file size to consider for duplicate detection (default: 0) */
  minSize?: number;
  /** Maximum file size to consider for duplicate detection (default: Infinity) */
  maxSize?: number;
  /** Specific providers to scan (default: all connected providers) */
  providers?: ProviderId[];
  /** Whether to include files in trash/recycle bin (default: false) */
  includeTrash?: boolean;
  /** Whether to scan recursively through folders (default: true) */
  recursive?: boolean;
}

/**
 * Service for detecting duplicate files across multiple storage providers
 */
export class DuplicateDetector {
  /**
   * Find duplicate files across multiple providers based on filename and size
   * @param providers Map of provider IDs to their adapter instances
   * @param authStates Map of provider IDs to their authentication states
   * @param options Detection options
   * @returns Promise resolving to groups of duplicate files
   */
  async findDuplicates(
    providers: Map<ProviderId, ProviderAdapter>,
    authStates: Map<ProviderId, ProviderAuthState>,
    options: DuplicateDetectionOptions = {}
  ): Promise<DuplicateFileGroup[]> {
    const {
      minSize = 0,
      maxSize = Infinity,
      providers: providerFilter,
      includeTrash = false,
      recursive = true
    } = options;

    // Determine which providers to scan
    const providersToScan = providerFilter 
      ? providerFilter.filter(id => providers.has(id) && authStates.has(id))
      : Array.from(providers.keys()).filter(id => authStates.has(id));

    // Collect all files from all providers
    const allFiles: DuplicateFileInfo[] = [];
    
    for (const providerId of providersToScan) {
      const provider = providers.get(providerId);
      const authState = authStates.get(providerId);
      
      if (!provider || !authState) {
        continue; // Skip providers without proper setup
      }

      try {
        // Get all files from this provider
        const providerFiles = await this.getAllFilesFromProvider(
          provider, 
          authState, 
          includeTrash, 
          recursive
        );

        // Filter files by size and add provider info
        const filteredFiles = providerFiles
          .filter(file => file.size >= minSize && file.size <= maxSize)
          .map(file => ({
            id: file.id,
            providerId,
            name: file.name,
            size: file.size,
            parentId: file.parentId,
            path: file.path,
            mimeType: file.mimeType,
            modifiedAt: file.modifiedAt,
            webUrl: file.webUrl
          }));

        allFiles.push(...filteredFiles);
      } catch (error) {
        // Log error but continue with other providers
        console.error(`Failed to scan provider ${providerId}:`, error);
        continue;
      }
    }

    // Group files by signature (normalized name + size)
    const fileGroups = new Map<string, DuplicateFileInfo[]>();
    
    for (const file of allFiles) {
      const signature = this.generateSignature(file.name, file.size);
      const existing = fileGroups.get(signature) || [];
      existing.push(file);
      fileGroups.set(signature, existing);
    }

    // Filter groups that have more than one file (actual duplicates)
    const duplicateGroups: DuplicateFileGroup[] = [];
    
    for (const [signature, files] of fileGroups) {
      if (files.length > 1) {
        // Extract filename and size from signature
        const parts = signature.split('|');
        if (parts.length >= 2) {
          const fileName = parts.slice(0, -1).join('|'); // Handle filenames with '|' in them
          const fileSize = parseInt(parts[parts.length - 1]);
          
          duplicateGroups.push({
            signature,
            fileName,
            fileSize,
            files
          });
        }
      }
    }

    return duplicateGroups;
  }

  /**
   * Generate a signature for duplicate detection based on filename and size
   * @param fileName The name of the file
   * @param size The size of the file in bytes
   * @returns A normalized signature string
   */
  private generateSignature(fileName: string, size: number): string {
    // Normalize the filename: convert to lowercase and trim whitespace
    const normalizedFileName = fileName.toLowerCase().trim();
    return `${normalizedFileName}|${size}`;
  }

  /**
   * Recursively get all files from a provider
   * @param provider The provider adapter
   * @param authState The authentication state for the provider
   * @param includeTrash Whether to include trashed files
   * @param recursive Whether to scan recursively
   * @returns Promise resolving to all files
   */
  private async getAllFilesFromProvider(
    provider: ProviderAdapter,
    authState: ProviderAuthState,
    includeTrash: boolean,
    recursive: boolean
  ): Promise<ProviderFile[]> {
    // Create a context for the operation
    const context = {
      requestId: `duplicate-scan-${Date.now()}`,
      userId: authState.accountId
    };

    const allFiles: ProviderFile[] = [];
    const foldersToProcess: string[] = ['root']; // Start with root folder

    while (foldersToProcess.length > 0) {
      const currentFolderId = foldersToProcess.shift()!;
      
      try {
        let listRequest = {
          context,
          auth: authState,
          folderId: currentFolderId === 'root' ? undefined : currentFolderId
        };

        // Get files from current folder
        const response = await provider.listFiles(listRequest);

        for (const file of response.files) {
          if (file.isFolder) {
            // Add folder to processing queue if recursive scanning is enabled
            if (recursive) {
              foldersToProcess.push(file.id);
            }
          } else {
            // Add file if it's not in trash or trash inclusion is allowed
            if (includeTrash || !this.isTrashed(file)) {
              allFiles.push(file);
            }
          }
        }

        // Handle pagination if there are more files
        if (response.nextCursor) {
          // For simplicity, we'll just get the first page for now
          // In a production implementation, we'd handle the cursor properly
        }
      } catch (error) {
        console.error(`Failed to list files in folder ${currentFolderId}:`, error);
        // Continue with other folders
        continue;
      }
    }

    return allFiles;
  }

  /**
   * Check if a file is in trash/recycle bin
   * @param file The file to check
   * @returns True if the file is in trash
   */
  private isTrashed(file: ProviderFile): boolean {
    // This is a simplified check - in reality, providers may have different ways
    // of indicating that a file is in trash. This would need to be implemented
    // per provider, but for now we'll assume no files are trashed
    return false;
  }
}
