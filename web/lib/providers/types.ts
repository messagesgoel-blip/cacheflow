/**
 * CacheFlow Provider Types
 * Unified TypeScript interfaces for all cloud storage providers
 */

// ============================================================================
// PROVIDER DEFINITIONS
// ============================================================================

export type ProviderId =
  | 'google'
  | 'onedrive'
  | 'dropbox'
  | 'box'
  | 'pcloud'
  | 'filen'
  | 'yandex'
  | 'webdav'
  | 'vps'
  | 'local'

export interface ProviderConfig {
  id: ProviderId
  name: string
  icon: string
  color: string
  freeStorageGB: number
  description: string
  authType: 'oauth' | 'basic' | 'token'
  website: string
  affiliateLink?: string
}

// All supported providers configuration
export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'google',
    name: 'Google Drive',
    icon: '🗂️',
    color: '#4285F4',
    freeStorageGB: 15,
    description: 'Connect to your Google Drive account',
    authType: 'oauth',
    website: 'https://drive.google.com',
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    icon: '☁️',
    color: '#0078D4',
    freeStorageGB: 5,
    description: 'Connect to your Microsoft OneDrive account',
    authType: 'oauth',
    website: 'https://onedrive.live.com',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    icon: '📦',
    color: '#0061FF',
    freeStorageGB: 2,
    description: 'Connect to your Dropbox account',
    authType: 'oauth',
    website: 'https://www.dropbox.com',
  },
  {
    id: 'box',
    name: 'Box',
    icon: '📁',
    color: '#0061D5',
    freeStorageGB: 10,
    description: 'Connect to your Box.com account',
    authType: 'oauth',
    website: 'https://www.box.com',
  },
  {
    id: 'pcloud',
    name: 'pCloud',
    icon: '🧊',
    color: '#004B8D',
    freeStorageGB: 10,
    description: 'Connect to pCloud storage',
    authType: 'oauth',
    website: 'https://www.pcloud.com',
    affiliateLink: 'https://partner.pcloud.com/?ref=cacheflow',
  },
  {
    id: 'filen',
    name: 'Filen',
    icon: '🔒',
    color: '#FF6B35',
    freeStorageGB: 10,
    description: 'Connect to Filen (End-to-End Encrypted)',
    authType: 'oauth',
    website: 'https://filen.io',
    affiliateLink: 'https://filen.io/?ref=cacheflow',
  },
  {
    id: 'yandex',
    name: 'Yandex Disk',
    icon: '📀',
    color: '#FFCC00',
    freeStorageGB: 10,
    description: 'Connect to Yandex Disk',
    authType: 'oauth',
    website: 'https://disk.yandex.com',
  },
  {
    id: 'webdav',
    name: 'WebDAV',
    icon: '🌐',
    color: '#5C7CFA',
    freeStorageGB: 0, // Varies
    description: 'Connect to any WebDAV server (Nextcloud, ownCloud, etc.)',
    authType: 'basic',
    website: '',
  },
  {
    id: 'vps',
    name: 'VPS / SFTP',
    icon: '🖥️',
    color: '#10B981',
    freeStorageGB: 0, // Varies by server (typically 50-200GB)
    description: 'Connect your own VPS or Linux server via SFTP',
    authType: 'basic', // SSH key or password
    website: '',
  },
  {
    id: 'local',
    name: 'Local Storage',
    icon: '💻',
    color: '#6B7280',
    freeStorageGB: 0,
    description: 'Internal server storage',
    authType: 'token',
    website: '',
  },
]

// ============================================================================
// TOKEN TYPES
// ============================================================================

export interface ProviderToken {
  provider: ProviderId
  accessToken: string
  refreshToken?: string
  expiresAt: number | null // Unix timestamp (ms), null if no expiration
  accountEmail: string
  displayName: string
  accountId?: string // Provider's internal account ID
  accountKey?: string // Unique key for the account within the provider
}

// ============================================================================
// FILE TYPES
// ============================================================================

export interface FileMetadata {
  id: string
  name: string
  path: string
  pathDisplay: string // Human-readable path
  size: number // bytes
  mimeType: string
  isFolder: boolean
  createdTime?: string // ISO date
  modifiedTime: string // ISO date
  provider: ProviderId
  providerName: string
  thumbnailUrl?: string
  webUrl?: string // Preview URL
  shareLink?: string // Public share link
  [key: string]: any // Allow dynamic properties from providers
}

export interface FolderMetadata extends FileMetadata {
  isFolder: true
  childCount?: number
}

export interface FileItemMetadata extends FileMetadata {
  isFolder: false
  hash?: string // For conflict detection
}

// ============================================================================
// QUOTA TYPES
// ============================================================================

export interface ProviderQuota {
  used: number // bytes
  total: number // bytes
  free: number // bytes
  usedDisplay: string // Human readable (e.g., "5.2 GB")
  totalDisplay: string
  freeDisplay: string
  percentUsed: number
}

// ============================================================================
// PROVIDER STATUS
// ============================================================================

export type ProviderStatus = 'connected' | 'disconnected' | 'error' | 'refreshing' | 'pending_oauth' | 'degraded' | 'needs_reauth'

export interface ProviderState {
  provider: ProviderId
  status: ProviderStatus
  token?: ProviderToken
  quota?: ProviderQuota
  error?: string
  lastSynced?: number // Unix timestamp
  accountEmail?: string
  displayName?: string
}

// ============================================================================
// CONNECTED PROVIDER (Persisted State)
// ============================================================================

export interface ConnectedProvider {
  providerId: ProviderId
  status: 'connected' | 'error' | 'degraded' | 'needs_reauth'
  accountEmail: string
  displayName: string
  accountKey?: string
  host?: string
  port?: number
  username?: string
  connectedAt: number // Unix timestamp
  lastSyncedAt?: number
  quota?: ProviderQuota
  error?: string
}

// ============================================================================
// USER SETTINGS
// ============================================================================

export interface UserSettings {
  browserOnlyMode: boolean // default: false (server storage enabled)
  autoRefreshTokens: boolean // default: true
  cacheTTLMinutes: number // default: 5
  theme: 'light' | 'dark' | 'system'
  defaultUploadProvider?: ProviderId // Auto-select provider for uploads
}

// ============================================================================
// TRANSFER TYPES
// ============================================================================

export type TransferStatus = 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled'
export type TransferType = 'upload' | 'download' | 'copy' | 'move'

export interface TransferJob {
  id: string
  type: TransferType
  sourceProvider: ProviderId
  targetProvider: ProviderId
  sourceFile: FileMetadata
  targetPath: string
  status: TransferStatus
  progress: number // 0-100
  bytesTransferred: number
  totalBytes: number
  error?: string
  startedAt: number
  completedAt?: number
}

// ============================================================================
// SEARCH TYPES
// ============================================================================

export interface AggregatedSearchResult {
  query: string
  results: FileMetadata[]
  providersSearched: ProviderId[]
  totalResults: number
  searchTimeMs: number
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface DashboardStats {
  totalStorage: number
  totalUsed: number
  totalFree: number
  providerCount: number
  fileCount: number
}

export interface DashboardWarning {
  providerId: ProviderId
  type: 'warning' | 'alert'
  message: string
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function getProviderById(id: ProviderId): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.id === id)
}

export function getProviderColor(id: ProviderId): string {
  return getProviderById(id)?.color ?? '#888888'
}

export function getProviderName(id: ProviderId): string {
  return getProviderById(id)?.name ?? 'Unknown'
}
