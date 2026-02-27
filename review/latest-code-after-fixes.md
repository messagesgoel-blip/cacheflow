# Latest Code After Fixes - Complete Combined

> Generated: Feb 27, 2026
> This file contains all the fixes applied in a single comprehensive document.

---

# PART 1: SHARED UTILITIES (NEW FILES)

## web/lib/providers/pkce.ts

```typescript
/**
 * Shared PKCE (Proof Key for Code Exchange) helpers
 * Used by OAuth-based providers for secure authentication
 */

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}

export function base64UrlEncode(array: Uint8Array): string {
  let str = ''
  array.forEach(byte => {
    str += String.fromCharCode(byte)
  })
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
```

## web/lib/providers/utils.ts

```typescript
/**
 * Shared utility functions for provider adapters
 */

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function formatMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',      // FIXED: Was 'image/gif'
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    tar: 'application/x-tar',
    gz: 'application/gzip',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    txt: 'text/plain',
  }
  return mimeTypes[ext] || 'application/octet-stream'
}
```

---

# PART 2: PROVIDER FIXES

## web/lib/providers/box.ts (Key Changes)

```typescript
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { formatBytes } from './utils'

// SECURITY FIX: Removed client_secret from PKCE flow
// Before: client_secret: process.env.NEXT_PUBLIC_BOX_CLIENT_SECRET || ''
// After: Removed entirely (PKCE doesn't require it)

// FIXED: Quota field name (alloted -> allocated)
const total = space.allocated || 0  // Was: space.alloted

// FIXED: Added retried parameter to prevent infinite 401 loops
private async makeRequest(url: string, options: RequestInit = {}, retried = false): Promise<any> {
  // ...
  if (!response.ok) {
    if (response.status === 401 && !retried) {  // Added !retried check
      const refreshed = await tokenManager.refreshToken('box')
      if (refreshed) {
        this.accessToken = refreshed.accessToken
        return this.makeRequest(url, options, true)  // Pass retried=true
      }
    }
  }
}
```

## web/lib/providers/filen.ts (Key Changes)

```typescript
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { formatBytes, formatMimeType } from './utils'

// SECURITY FIX: Token moved from URL query param to Authorization header
private async req(ep: string, body?: any, retried = false): Promise<any> {
  // BEFORE: Token in URL
  // const u = new URL(FILEN_API_BASE+ep)
  // if (this.accessToken) u.searchParams.set('auth', this.accessToken)
  
  // AFTER: Token in Authorization header
  const res = await fetch(FILEN_API_BASE+ep, {
    method: 'POST', 
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`  // SECURE
    },
    body: body ? JSON.stringify(body) : undefined
  })
  
  // FIXED: Added retried parameter
  if (res.status === 401 && !retried) {
    const nt = await tokenManager.refreshToken('filen')
    if (nt) {
      this.accessToken = nt.accessToken
      return this.req(ep, body, true)  // Pass retried=true
    }
  }
}

// SECURITY FIX: uploadFile and downloadFile also use Authorization header
async uploadFile(f: File, o?: UploadOptions): Promise<FileMetadata> {
  const res = await fetch(FILEN_API_BASE+'/v1/file/upload', { 
    method: 'POST', 
    body: fd,
    headers: { Authorization: `Bearer ${this.accessToken}` }
  })
}

async downloadFile(id: string): Promise<Blob> {
  const res = await fetch(FILEN_API_BASE+'/v1/file/download?uuid='+id, {
    headers: { Authorization: `Bearer ${this.accessToken}` }
  })
}

// FIXED: Use formatMimeType instead of buggy gm()
private mf(i: any): FileMetadata {
  return { 
    // ...
    mimeType: f ? 'application/vnd.folder' : formatMimeType(i.name),  // Was: gm(i.name)
  }
}
```

## web/lib/providers/pcloud.ts (Key Changes)

```typescript
// SECURITY FIX: Token moved to Authorization header
private async req(ep: string, body?: any, retried = false): Promise<any> {
  const u = new URL(PCLOUD_API_BASE+ep)
  // BEFORE: if (this.accessToken) u.searchParams.set('access_token', this.accessToken)
  
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${this.accessToken}` }  // SECURE
  })
  
  if (res.status === 401 && !retried) { /* ... */ }
}
```

## web/lib/providers/dropbox.ts (Key Changes)

```typescript
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { formatBytes, formatMimeType } from './utils'

// FIXED: Added retried parameter
private async makeRequest(endpoint: string, body?: any, retried = false): Promise<any> {
  if (!response.ok) {
    if (response.status === 401 && !retried) {  // Added !retried
      const refreshed = await tokenManager.refreshToken('dropbox')
      if (refreshed) {
        this.accessToken = refreshed.accessToken
        return this.makeRequest(endpoint, body, true)  // Pass retried=true
      }
    }
  }
}

// FIXED: Use formatMimeType
mimeType: isFolder ? 'application/vnd.folder' : formatMimeType(item.name)
```

## web/lib/providers/oneDrive.ts (Key Changes)

```typescript
import { formatBytes, formatMimeType } from './utils'

// FIXED: downloadUrl access method
async downloadFile(fileId: string): Promise<Blob> {
  const file = await this.getFile(fileId)
  const downloadUrl = (file as any).downloadUrl  // Was: file['@microsoft.graph.downloadUrl']
  if (!downloadUrl) throw new Error('Download URL not available')
  const response = await fetch(downloadUrl)
  return response.blob()
}

// FIXED: Added retried parameter
private async makeRequest(url: string, options: RequestInit = {}, retried = false): Promise<any> {
  if (response.status === 401 && !retried) { /* ... */ }
}
```

## web/lib/providers/googleDrive.ts (Key Changes)

```typescript
// FIXED: Explicit allowlist for Google Docs export
const googleDocsTypes = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing',
  'application/vnd.google-apps.form',
  'application/vnd.google-apps.audio',
]
if (googleDocsTypes.includes(metadata.mimeType)) { /* export */ }

// FIXED: moveFile - direct API call instead of cached data
async moveFile(fileId: string, newParentId: string): Promise<FileMetadata> {
  const fileResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`,
    { headers: { Authorization: `Bearer ${this.accessToken}` } }
  )
  const fileData = await fileResponse.json()
  const previousParents = fileData.parents || []
  // ... update with new parent
}

// FIXED: Icon
getIcon(): string { return '📁' }  // Was: '📧'

// FIXED: Added retried parameter
private async makeRequest(url: string, options: RequestInit = {}, retried = false): Promise<any> {
  if (response.status === 401 && !retried) { /* ... */ }
}
```

## web/lib/providers/types.ts (Key Change)

```typescript
// FIXED: Google Drive icon
{
  id: 'google',
  name: 'Google Drive',
  icon: '📁',  // Was: '📧'
  // ...
}
```

---

# PART 3: COMPONENT FIXES

## web/components/FileBrowser.tsx (Key Sections)

```typescript
export default function FileBrowser({ token, currentPath = '/', locationId, onPathChange, onRefresh }) {
  // ...
  
  // COMPONENT-LEVEL: Cloud provider detection (FIXED: moved outside loadCurrentPath)
  const isCloud = locationId?.startsWith('cloud-') ?? false
  const cloudProviderId = isCloud ? locationId?.replace('cloud-', '') as ProviderId : null

  // FIXED: handleUpload routes to correct provider
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (isCloud && cloudProviderId) {
      const provider = getProvider(cloudProviderId)
      if (provider) {
        await provider.uploadFile(file, { folderId: currentPath === '/' ? undefined : currentPath })
      }
    } else {
      await uploadFile(file, token, currentPath === '/' ? undefined : currentPath)
    }
  }

  // FIXED: handleCreateFolder routes to correct provider
  async function handleCreateFolder() {
    if (isCloud && cloudProviderId) {
      const provider = getProvider(cloudProviderId)
      if (provider) {
        await provider.createFolder(newFolderName, currentPath === '/' ? undefined : currentPath)
      }
    } else {
      const folderPath = currentPath === '/' ? newFolderName : `${currentPath}/${newFolderName}`
      await createFolder(folderPath, token)
    }
  }

  // FIXED: Context menu stubs now show alerts
  async function handleDownload(fileId: string, filePath: string) {
    console.warn('not yet implemented: download', fileId, filePath)
    alert('Download is not yet implemented')
  }
  // ... similarly for handleShare, handleRename, handleMove, handleDelete, handleRetry
}
```

## web/components/FolderTree.tsx (Key Sections)

```typescript
import { useState, useEffect, useRef } from 'react'
import { browseFiles } from '@/lib/api'
import { getProvider } from '@/lib/providers'
import { ProviderId } from '@/lib/providers/types'

export default function FolderTree({ token, locationId, currentPath, onFolderSelect, onRefresh }) {
  const loadedPathsRef = useRef<Set<string>>(new Set())
  
  // Cloud provider detection
  const isCloud = locationId?.startsWith('cloud-') ?? false
  const cloudProviderId = isCloud ? locationId?.replace('cloud-', '') as ProviderId : null

  // FIXED: Prevent re-fetching empty folders
  async function loadFolders(path: string) {
    if (loadedPathsRef.current.has(path)) return  // Skip if already loaded
    
    // FIXED: Cloud provider guard
    if (isCloud && cloudProviderId) {
      const provider = getProvider(cloudProviderId)
      if (provider) {
        const result = await provider.listFiles({ folderId: path })
        folderItems = result.files
          .filter((f: any) => f.isFolder)
          .map((f: any) => ({ name: f.name, path: f.path, isFolder: true }))
      }
    } else {
      const data = await browseFiles(path, token, locationId)
      folderItems = data.folders || []
    }
    
    loadedPathsRef.current.add(path)  // Mark as loaded
  }

  // FIXED: Use loadedPathsRef instead of hasChildren check
  async function ensureFolderLoaded(path: string) {
    if (loadedPathsRef.current.has(path)) return
    await loadFolders(path)
  }
}
```

## web/components/RemotesPanel.tsx (Key Sections)

```typescript
// FIXED: Static import instead of dynamic
import { getProvider } from '@/lib/providers'

// ...

async function handleOAuthConnect(providerId: string) {
  // BEFORE: const providers = await import("@/lib/providers")
  // AFTER: Direct use of imported getProvider
  const provider = getProvider(providerId as any)
  
  // FIXED: Proper error handling instead of if(false) block
  const response = await fetch("/api/tokens", { /* ... */ })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || "Failed to save token")
  }
}
```

## web/components/DrivePanel.tsx (Key Sections)

```typescript
export default function DrivePanel({ token, onLocationSelect, onRefresh }) {
  const [quotaLoading, setQuotaLoading] = useState(false)

  async function getCloudProvidersWithQuotas() {
    // FIXED: Parallel quota fetching
    setQuotaLoading(true)
    const quotaResults = await Promise.allSettled(
      locationsWithTokens.map(async ({ pid }) => {
        const provider = getProvider(pid)
        if (provider) return await provider.getQuota()
        return { used: 0, total: 0, ... }
      })
    )
    setQuotaLoading(false)
    
    // Build locations with quota data
    // ...
  }

  // In render:
  {quotaLoading ? (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-16 mb-1"></div>
      <div className="h-3 bg-gray-200 rounded w-12"></div>
    </div>
  ) : (
    <>{formatBytes(location.totalSize)}</>
  )}
}
```

## web/components/ThemeToggle.tsx (Key Sections)

```typescript
import { useState, useEffect, useCallback } from 'react'

export default function ThemeToggle() {
  // FIXED: Use useCallback with functional setState to avoid stale closure
  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const newIsDark = !prev
      if (newIsDark) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('cf_theme', 'dark')
      } else {
        document.documentElement.classList.add('light')
        localStorage.setItem('cf_theme', 'light')
      }
      return newIsDark
    })
  }, [])  // Stable reference

  // FIXED: toggleTheme in dependency array
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        toggleTheme()  // Now uses stable callback
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleTheme])  // Includes toggleTheme
}
```

## web/components/UploadModal.tsx (Key Change)

```typescript
// FIXED: Use provider.icon instead of hardcoded emoji
{
  connectedProviders.map(cp => {
    const provider = PROVIDERS.find(p => p.id === cp.providerId)
    return (
      <span>{provider?.icon || '📁'}</span>  // Was: provider?.name === 'Google Drive' ? '📧' : ...
    )
  })
}
```

## web/components/ProviderHub.tsx (Key Change)

```typescript
function getProviderIcon(providerId: ProviderId): string {
  const icons: Record<ProviderId, string> = {
    google: '🗂️',  // Was: '📧'
    onedrive: '☁️',
    dropbox: '📦',
    box: '📁',
    pcloud: '☁️',
    filen: '🔒',
    yandex: '📀',
    webdav: '🌐',
    vps: '🖥️',
  }
  return icons[providerId] || '📁'
}
```

---

# SUMMARY OF ALL FIXES

## Security Fixes
1. ✅ Removed `client_secret` from box.ts (PKCE doesn't need it)
2. ✅ Moved tokens from URL query params to Authorization headers (filen.ts, pcloud.ts)
3. ✅ Added `retried` parameter to prevent infinite 401 loops (all providers)

## High Priority Bugs
1. ✅ FileBrowser: handleUpload routes to correct cloud provider
2. ✅ FileBrowser: handleCreateFolder routes to correct cloud provider
3. ✅ FileBrowser: Context menu stubs show alerts
4. ✅ FolderTree: loadedPaths ref prevents re-fetching empty folders
5. ✅ FolderTree: Cloud provider guard for browseFiles
6. ✅ RemotesPanel: Static import instead of dynamic
7. ✅ RemotesPanel: Removed dead if(false) code block

## Medium Priority Bugs
1. ✅ DrivePanel: Parallel quota fetching with loading state
2. ✅ ThemeToggle: Fixed stale closure on keyboard shortcut
3. ✅ ProviderHub/RemotesPanel: Fixed Google Drive icon (🗂️)
4. ✅ UploadModal: Use provider.icon instead of hardcoded emojis

## Cleanup
1. ✅ Created shared pkce.ts module
2. ✅ Created shared utils.ts module
3. ✅ Fixed mime type mappings (png→gif bug)
4. ✅ Deleted backup/tmp files

---

*End of file - All fixes combined*
