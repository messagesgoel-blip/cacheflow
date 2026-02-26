/**
 * Mock Providers for UI Development
 * Use these to build and test UI components without real OAuth credentials
 */

import { ProviderId, ProviderState, ProviderQuota, FileMetadata, ConnectedProvider, TransferJob } from './types'

// ============================================================================
// MOCK QUOTAS
// ============================================================================

const mockQuotas: Record<ProviderId, ProviderQuota> = {
  google: {
    used: 5_234_567_890,
    total: 15_000_000_000,
    free: 9_765_432_110,
    usedDisplay: '5.23 GB',
    totalDisplay: '15 GB',
    freeDisplay: '9.77 GB',
    percentUsed: 34.9,
  },
  onedrive: {
    used: 1_536_000_000,
    total: 5_000_000_000,
    free: 3_464_000_000,
    usedDisplay: '1.54 GB',
    totalDisplay: '5 GB',
    freeDisplay: '3.46 GB',
    percentUsed: 30.7,
  },
  dropbox: {
    used: 890_000_000,
    total: 2_000_000_000,
    free: 1_110_000_000,
    usedDisplay: '890 MB',
    totalDisplay: '2 GB',
    freeDisplay: '1.11 GB',
    percentUsed: 44.5,
  },
  box: {
    used: 2_500_000_000,
    total: 10_000_000_000,
    free: 7_500_000_000,
    usedDisplay: '2.5 GB',
    totalDisplay: '10 GB',
    freeDisplay: '7.5 GB',
    percentUsed: 25,
  },
  pcloud: {
    used: 3_200_000_000,
    total: 10_000_000_000,
    free: 6_800_000_000,
    usedDisplay: '3.2 GB',
    totalDisplay: '10 GB',
    freeDisplay: '6.8 GB',
    percentUsed: 32,
  },
  filen: {
    used: 512_000_000,
    total: 10_000_000_000,
    free: 9_488_000_000,
    usedDisplay: '512 MB',
    totalDisplay: '10 GB',
    freeDisplay: '9.49 GB',
    percentUsed: 5.1,
  },
  yandex: {
    used: 4_100_000_000,
    total: 10_000_000_000,
    free: 5_900_000_000,
    usedDisplay: '4.1 GB',
    totalDisplay: '10 GB',
    freeDisplay: '5.9 GB',
    percentUsed: 41,
  },
  webdav: {
    used: 15_000_000_000,
    total: 50_000_000_000,
    free: 35_000_000_000,
    usedDisplay: '15 GB',
    totalDisplay: '50 GB',
    freeDisplay: '35 GB',
    percentUsed: 30,
  },
}

// ============================================================================
// MOCK FILE DATA
// ============================================================================

const mockFiles: Record<ProviderId, FileMetadata[]> = {
  google: [
    {
      id: 'gdrive-1',
      name: 'Documents',
      path: '/Documents',
      pathDisplay: '/Documents',
      size: 0,
      mimeType: 'application/vnd.folder',
      isFolder: true,
      modifiedTime: '2026-02-20T10:30:00Z',
      provider: 'google',
      providerName: 'Google Drive',
    },
    {
      id: 'gdrive-2',
      name: 'Photos',
      path: '/Photos',
      pathDisplay: '/Photos',
      size: 0,
      mimeType: 'application/vnd.folder',
      isFolder: true,
      modifiedTime: '2026-02-18T14:20:00Z',
      provider: 'google',
      providerName: 'Google Drive',
    },
    {
      id: 'gdrive-3',
      name: 'Budget 2026.xlsx',
      path: '/Documents/Budget 2026.xlsx',
      pathDisplay: '/Documents/Budget 2026.xlsx',
      size: 2_456_789,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      isFolder: false,
      modifiedTime: '2026-02-25T09:15:00Z',
      provider: 'google',
      providerName: 'Google Drive',
    },
    {
      id: 'gdrive-4',
      name: 'Project Proposal.pdf',
      path: '/Documents/Project Proposal.pdf',
      pathDisplay: '/Documents/Project Proposal.pdf',
      size: 8_234_567,
      mimeType: 'application/pdf',
      isFolder: false,
      modifiedTime: '2026-02-24T16:45:00Z',
      provider: 'google',
      providerName: 'Google Drive',
    },
    {
      id: 'gdrive-5',
      name: 'Family Vacation.jpg',
      path: '/Photos/Family Vacation.jpg',
      pathDisplay: '/Photos/Family Vacation.jpg',
      size: 4_567_890,
      mimeType: 'image/jpeg',
      isFolder: false,
      modifiedTime: '2026-02-15T11:30:00Z',
      provider: 'google',
      providerName: 'Google Drive',
    },
  ],
  onedrive: [
    {
      id: 'onedrive-1',
      name: 'Work',
      path: '/Work',
      pathDisplay: '/Work',
      size: 0,
      mimeType: 'application/vnd.folder',
      isFolder: true,
      modifiedTime: '2026-02-22T08:00:00Z',
      provider: 'onedrive',
      providerName: 'OneDrive',
    },
    {
      id: 'onedrive-2',
      name: 'Quarterly Report.docx',
      path: '/Work/Quarterly Report.docx',
      pathDisplay: '/Work/Quarterly Report.docx',
      size: 1_234_567,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      isFolder: false,
      modifiedTime: '2026-02-26T10:00:00Z',
      provider: 'onedrive',
      providerName: 'OneDrive',
    },
    {
      id: 'onedrive-3',
      name: 'Meeting Notes.txt',
      path: '/Work/Meeting Notes.txt',
      pathDisplay: '/Work/Meeting Notes.txt',
      size: 45_678,
      mimeType: 'text/plain',
      isFolder: false,
      modifiedTime: '2026-02-25T15:30:00Z',
      provider: 'onedrive',
      providerName: 'OneDrive',
    },
  ],
  dropbox: [
    {
      id: 'dropbox-1',
      name: 'Backup',
      path: '/Backup',
      pathDisplay: '/Backup',
      size: 0,
      mimeType: 'application/vnd.folder',
      isFolder: true,
      modifiedTime: '2026-02-10T12:00:00Z',
      provider: 'dropbox',
      providerName: 'Dropbox',
    },
    {
      id: 'dropbox-2',
      name: 'Archive 2025.zip',
      path: '/Backup/Archive 2025.zip',
      pathDisplay: '/Backup/Archive 2025.zip',
      size: 890_000_000,
      mimeType: 'application/zip',
      isFolder: false,
      modifiedTime: '2026-01-15T09:00:00Z',
      provider: 'dropbox',
      providerName: 'Dropbox',
    },
  ],
  box: [
    {
      id: 'box-1',
      name: 'Shared',
      path: '/Shared',
      pathDisplay: '/Shared',
      size: 0,
      mimeType: 'application/vnd.folder',
      isFolder: true,
      modifiedTime: '2026-02-19T14:00:00Z',
      provider: 'box',
      providerName: 'Box',
    },
    {
      id: 'box-2',
      name: 'Team Presentation.pptx',
      path: '/Shared/Team Presentation.pptx',
      pathDisplay: '/Shared/Team Presentation.pptx',
      size: 15_678_901,
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      isFolder: false,
      modifiedTime: '2026-02-26T08:30:00Z',
      provider: 'box',
      providerName: 'Box',
    },
  ],
  pcloud: [
    {
      id: 'pcloud-1',
      name: 'Music',
      path: '/Music',
      pathDisplay: '/Music',
      size: 0,
      mimeType: 'application/vnd.folder',
      isFolder: true,
      modifiedTime: '2026-02-01T16:00:00Z',
      provider: 'pcloud',
      providerName: 'pCloud',
    },
    {
      id: 'pcloud-2',
      name: 'Playlist.m3u',
      path: '/Music/Playlist.m3u',
      pathDisplay: '/Music/Playlist.m3u',
      size: 12_345,
      mimeType: 'audio/mpegurl',
      isFolder: false,
      modifiedTime: '2026-02-20T20:00:00Z',
      provider: 'pcloud',
      providerName: 'pCloud',
    },
  ],
  filen: [
    {
      id: 'filen-1',
      name: 'Private',
      path: '/Private',
      pathDisplay: '/Private',
      size: 0,
      mimeType: 'application/vnd.folder',
      isFolder: true,
      modifiedTime: '2026-02-05T10:00:00Z',
      provider: 'filen',
      providerName: 'Filen',
    },
    {
      id: 'filen-2',
      name: 'Sensitive Data.enc',
      path: '/Private/Sensitive Data.enc',
      pathDisplay: '/Private/Sensitive Data.enc',
      size: 512_000_000,
      mimeType: 'application/octet-stream',
      isFolder: false,
      modifiedTime: '2026-02-25T22:00:00Z',
      provider: 'filen',
      providerName: 'Filen',
    },
  ],
  yandex: [
    {
      id: 'yandex-1',
      name: 'Downloads',
      path: '/Downloads',
      pathDisplay: '/Downloads',
      size: 0,
      mimeType: 'application/vnd.folder',
      isFolder: true,
      modifiedTime: '2026-02-23T18:00:00Z',
      provider: 'yandex',
      providerName: 'Yandex Disk',
    },
    {
      id: 'yandex-2',
      name: 'Software Installer.exe',
      path: '/Downloads/Software Installer.exe',
      pathDisplay: '/Downloads/Software Installer.exe',
      size: 4_100_000_000,
      mimeType: 'application/x-msdownload',
      isFolder: false,
      modifiedTime: '2026-02-23T18:00:00Z',
      provider: 'yandex',
      providerName: 'Yandex Disk',
    },
  ],
  webdav: [
    {
      id: 'webdav-1',
      name: 'Server Backups',
      path: '/Backups',
      pathDisplay: '/Backups',
      size: 0,
      mimeType: 'application/vnd.folder',
      isFolder: true,
      modifiedTime: '2026-02-26T02:00:00Z',
      provider: 'webdav',
      providerName: 'WebDAV',
    },
    {
      id: 'webdav-2',
      name: 'server-config.tar.gz',
      path: '/Backups/server-config.tar.gz',
      pathDisplay: '/Backups/server-config.tar.gz',
      size: 15_000_000_000,
      mimeType: 'application/gzip',
      isFolder: false,
      modifiedTime: '2026-02-26T02:00:00Z',
      provider: 'webdav',
      providerName: 'WebDAV',
    },
  ],
}

// ============================================================================
// MOCK CONNECTED PROVIDERS
// ============================================================================

export const mockConnectedProviders: ConnectedProvider[] = [
  {
    providerId: 'google',
    status: 'connected',
    accountEmail: 'user@gmail.com',
    displayName: 'User Google',
    connectedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
    lastSyncedAt: Date.now() - 5 * 60 * 1000, // 5 mins ago
    quota: mockQuotas.google,
  },
  {
    providerId: 'onedrive',
    status: 'connected',
    accountEmail: 'user@outlook.com',
    displayName: 'User Microsoft',
    connectedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
    lastSyncedAt: Date.now() - 10 * 60 * 1000,
    quota: mockQuotas.onedrive,
  },
  {
    providerId: 'dropbox',
    status: 'connected',
    accountEmail: 'user@dropbox.com',
    displayName: 'User Dropbox',
    connectedAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
    lastSyncedAt: Date.now() - 30 * 60 * 1000,
    quota: mockQuotas.dropbox,
  },
  {
    providerId: 'webdav',
    status: 'connected',
    accountEmail: 'admin@myserver.com',
    displayName: 'My Server',
    connectedAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    lastSyncedAt: Date.now() - 60 * 60 * 1000,
    quota: mockQuotas.webdav,
  },
]

// ============================================================================
// MOCK PROVIDER STATES
// ============================================================================

export const mockProviderStates: ProviderState[] = mockConnectedProviders.map(cp => ({
  provider: cp.providerId,
  status: cp.status,
  token: {
    provider: cp.providerId,
    accessToken: 'mock_access_token_' + cp.providerId,
    refreshToken: 'mock_refresh_token_' + cp.providerId,
    expiresAt: Date.now() + 60 * 60 * 1000,
    accountEmail: cp.accountEmail,
    displayName: cp.displayName,
  },
  quota: cp.quota,
  lastSynced: cp.lastSyncedAt,
  accountEmail: cp.accountEmail,
  displayName: cp.displayName,
}))

// ============================================================================
// MOCK TRANSFERS
// ============================================================================

export const mockTransfers: TransferJob[] = [
  {
    id: 'transfer-1',
    type: 'copy',
    sourceProvider: 'google',
    targetProvider: 'onedrive',
    sourceFile: mockFiles.google[2],
    targetPath: '/Work/Budget 2026.xlsx',
    status: 'completed',
    progress: 100,
    bytesTransferred: 2_456_789,
    totalBytes: 2_456_789,
    startedAt: Date.now() - 10 * 60 * 1000,
    completedAt: Date.now() - 9 * 60 * 1000,
  },
  {
    id: 'transfer-2',
    type: 'upload',
    sourceProvider: 'local',
    targetProvider: 'dropbox',
    sourceFile: {
      id: 'local-1',
      name: 'New Document.pdf',
      path: '/Downloads/New Document.pdf',
      pathDisplay: '/Downloads/New Document.pdf',
      size: 5_678_901,
      mimeType: 'application/pdf',
      isFolder: false,
      modifiedTime: new Date().toISOString(),
      provider: 'local',
      providerName: 'Local',
    },
    targetPath: '/Backup/New Document.pdf',
    status: 'transferring',
    progress: 67,
    bytesTransferred: 3_805_023,
    totalBytes: 5_678_901,
    startedAt: Date.now() - 30 * 1000,
  },
  {
    id: 'transfer-3',
    type: 'move',
    sourceProvider: 'google',
    targetProvider: 'pcloud',
    sourceFile: mockFiles.google[4],
    targetPath: '/Photos/Family Vacation.jpg',
    status: 'pending',
    progress: 0,
    bytesTransferred: 0,
    totalBytes: 4_567_890,
    startedAt: Date.now(),
  },
]

// ============================================================================
// HELPER FUNCTIONS FOR MOCK DATA
// ============================================================================

export function getMockQuota(providerId: ProviderId): ProviderQuota {
  return mockQuotas[providerId]
}

export function getMockFiles(providerId?: ProviderId): FileMetadata[] {
  if (providerId) {
    return mockFiles[providerId] || []
  }
  // Return all files from all providers
  return Object.values(mockFiles).flat()
}

export function getMockConnectedProviders(): ConnectedProvider[] {
  return mockConnectedProviders
}

export function getMockProviderStates(): ProviderState[] {
  return mockProviderStates
}

export function getMockTransfers(): TransferJob[] {
  return mockTransfers
}

export function getTotalStats() {
  const providers = mockConnectedProviders
  const totalStorage = providers.reduce((sum, p) => sum + (p.quota?.total ?? 0), 0)
  const totalUsed = providers.reduce((sum, p) => sum + (p.quota?.used ?? 0), 0)
  const totalFree = providers.reduce((sum, p) => sum + (p.quota?.free ?? 0), 0)

  return {
    totalStorage,
    totalUsed,
    totalFree,
    totalStorageDisplay: formatBytes(totalStorage),
    totalUsedDisplay: formatBytes(totalUsed),
    totalFreeDisplay: formatBytes(totalFree),
    providerCount: providers.length,
    fileCount: getMockFiles().length,
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// ============================================================================
// DEFAULT EXPORTS
// ============================================================================

export default {
  getMockQuota,
  getMockFiles,
  getMockConnectedProviders,
  getMockProviderStates,
  getMockTransfers,
  getTotalStats,
}
