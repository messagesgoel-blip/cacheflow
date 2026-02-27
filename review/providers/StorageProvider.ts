/**
 * Storage Provider Base Class
 * Abstract class that all cloud storage providers must implement
 */

import { ProviderToken, ProviderQuota, FileMetadata, ProviderId } from './types'

export interface ProviderOptions {
  // Optional configuration for the provider
  [key: string]: any
}

export interface ListFilesOptions {
  folderId?: string
  pageSize?: number
  pageToken?: string
}

export interface ListFilesResult {
  files: FileMetadata[]
  nextPageToken?: string
  hasMore: boolean
}

export interface UploadOptions {
  folderId?: string
  fileName?: string
  onProgress?: (progress: number) => void
  abortSignal?: AbortSignal
}

export interface DownloadOptions {
  onProgress?: (progress: number) => void
  abortSignal?: AbortSignal
}

export interface SearchOptions {
  query: string
  folderId?: string
  pageSize?: number
  pageToken?: string
}

export interface SearchResult {
  files: FileMetadata[]
  nextPageToken?: string
  hasMore: boolean
}

/**
 * Abstract base class for all storage providers
 * All providers must implement these methods
 */
export abstract class StorageProvider {
  // Provider identification
  abstract readonly id: ProviderId
  abstract readonly name: string

  // Authentication
  /**
   * Initiate OAuth flow - opens popup for user to authorize
   * @returns Promise that resolves with token on success
   */
  abstract connect(): Promise<ProviderToken>

  /**
   * Disconnect and revoke tokens
   */
  abstract disconnect(): Promise<void>

  /**
   * Refresh the access token using refresh token
   */
  abstract refreshToken(token: ProviderToken): Promise<ProviderToken>

  /**
   * Check if token is valid and not expired
   */
  abstract isTokenValid(token: ProviderToken): boolean

  // Quota / Storage Info
  /**
   * Get current storage quota information
   */
  abstract getQuota(): Promise<ProviderQuota>

  // File Operations
  /**
   * List files in a folder
   */
  abstract listFiles(options?: ListFilesOptions): Promise<ListFilesResult>

  /**
   * Get a specific file's metadata
   */
  abstract getFile(fileId: string): Promise<FileMetadata>

  /**
   * Upload a file
   */
  abstract uploadFile(file: File, options?: UploadOptions): Promise<FileMetadata>

  /**
   * Download a file
   */
  abstract downloadFile(fileId: string, options?: DownloadOptions): Promise<Blob>

  /**
   * Delete a file
   */
  abstract deleteFile(fileId: string): Promise<void>

  /**
   * Create a folder
   */
  abstract createFolder(name: string, parentId?: string): Promise<FileMetadata>

  /**
   * Move a file to a different folder
   */
  abstract moveFile(fileId: string, newParentId: string): Promise<FileMetadata>

  /**
   * Copy a file
   */
  abstract copyFile(fileId: string, newParentId: string): Promise<FileMetadata>

  /**
   * Rename a file
   */
  abstract renameFile(fileId: string, newName: string): Promise<FileMetadata>

  // Sharing
  /**
   * Get a public share link for a file
   */
  abstract getShareLink(fileId: string): Promise<string | null>

  /**
   * Revoke a share link
   */
  abstract revokeShareLink(fileId: string): Promise<void>

  // Search
  /**
   * Search for files by name
   */
  abstract searchFiles(options: SearchOptions): Promise<SearchResult>

  // Utility methods (default implementations)
  /**
   * Get the provider's icon URL or emoji
   */
  getIcon(): string {
    return '📁'
  }

  /**
   * Get the provider's brand color
   */
  getColor(): string {
    return '#888888'
  }

  /**
   * Get the provider's free tier size in bytes
   */
  getFreeStorageGB(): number {
    return 0
  }

  /**
   * Validate configuration before connecting
   */
  validateConfig(config: ProviderOptions): { valid: boolean; error?: string } {
    return { valid: true }
  }

  /**
   * Get the OAuth authorization URL (for custom flows)
   */
  getAuthUrl(): string {
    return ''
  }

  /**
   * Handle OAuth callback (for custom flows)
   */
  handleCallback(code: string): Promise<ProviderToken> {
    throw new Error('Not implemented - use connect() for standard OAuth')
  }
}

/**
 * Factory function to create a provider instance
 */
export type ProviderFactory = () => StorageProvider

/**
 * Registry of all available providers
 */
export class ProviderRegistry {
  private providers: Map<ProviderId, ProviderFactory> = new Map()

  /**
   * Register a provider
   */
  register(id: ProviderId, factory: ProviderFactory): void {
    this.providers.set(id, factory)
  }

  /**
   * Get a provider instance
   */
  get(id: ProviderId): StorageProvider | undefined {
    if (typeof window === 'undefined') return undefined
    const factory = this.providers.get(id)
    return factory ? factory() : undefined
  }

  /**
   * Get all registered provider IDs
   */
  getAllIds(): ProviderId[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Check if a provider is registered
   */
  has(id: ProviderId): boolean {
    return this.providers.has(id)
  }
}

// Export singleton registry instance
export const providerRegistry = new ProviderRegistry()
