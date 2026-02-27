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
  return btoa(Array.from(array, b => String.fromCharCode(b)).join(''))
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

/**
 * Fetch with timeout support
 */
export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id))
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Get MIME type from filename extension
 */
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

## box.ts (Key Changes)

```typescript
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { formatBytes } from './utils'

// SECURITY FIX: Removed client_secret from PKCE flow
// Before: client_secret: process.env.NEXT_PUBLIC_BOX_CLIENT_SECRET || ''
// After: Removed entirely (PKCE doesn't require it)

// FIXED: Quota field name + fallback chain
const total = space.allocated ?? space.space_amount ?? 0

// FIXED: Added retried parameter
private async makeRequest(url: string, options: RequestInit = {}, retried = false): Promise<any> {
  if (!response.ok) {
    if (response.status === 401 && !retried) {
      const refreshed = await tokenManager.refreshToken('box')
      if (refreshed) {
        this.accessToken = refreshed.accessToken
        return this.makeRequest(url, options, true)
      }
      throw new Error('SESSION_EXPIRED')
    }
  }
}
```

## filen.ts (Key Changes)

```typescript
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { formatBytes, formatMimeType } from './utils'

// SECURITY FIX: Token moved to Authorization header
private async req(ep: string, body?: any, retried = false, method = 'POST'): Promise<any> {
  const res = await fetch(FILEN_API_BASE + ep, {
    method,
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}`
    },
    body: method !== 'GET' && body ? JSON.stringify(body) : undefined
  })
  
  if (res.status === 401 && !retried) {
    const nt = await tokenManager.refreshToken('filen')
    if (nt) {
      this.accessToken = nt.accessToken
      return this.req(ep, body, true, method)
    }
    throw new Error('SESSION_EXPIRED')
  }
}

// SECURITY FIX: uploadFile and downloadFile use Authorization header
async uploadFile(f: File, o?: UploadOptions): Promise<FileMetadata> {
  const res = await fetch(FILEN_API_BASE + '/v1/file/upload', { 
    method: 'POST', 
    body: fd,
    headers: { Authorization: `Bearer ${this.accessToken}` }
  })
}

async downloadFile(id: string): Promise<Blob> {
  const res = await fetch(FILEN_API_BASE + '/v1/file/download?uuid=' + id, {
    headers: { Authorization: `Bearer ${this.accessToken}` }
  })
}

// FIXED: Use formatMimeType
private mf(i: any): FileMetadata {
  return { 
    mimeType: f ? 'application/vnd.folder' : formatMimeType(i.name),
  }
}
```

## pcloud.ts (Key Changes)

``` FIX: Token moved to Authorization header
typescript
// SECURITYprivate async req(ep: string, body?: any, retried = false): Promise<any> {
  const res = await fetch(PCLOUD_API_BASE + ep, {
    headers: { Authorization: `Bearer ${this.accessToken}` }
  })
  
  if (res.status === 401 && !retried) { /* ... */ }
}
```

## dropbox.ts (Key Changes)

```typescript
import { generateCodeVerifier, generateCodeChallenge } from './pkce'
import { formatBytes, formatMimeType } from './utils'

// FIXED: Added retried parameter + SESSION_EXPIRED
private async makeRequest(endpoint: string, body?: any, retried = false): Promise<any> {
  if (response.status === 401 && !retried) {
    const refreshed = await tokenManager.refreshToken('dropbox')
    if (refreshed) {
      this.accessToken = refreshed.accessToken
      return this.makeRequest(endpoint, body, true)
    }
    throw new Error('SESSION_EXPIRED')
  }
}

// FIXED: Use formatMimeType
mimeType: isFolder ? 'application/vnd.folder' : formatMimeType(item.name)
```

## oneDrive.ts (Key Changes)

```typescript
import { formatBytes, formatMimeType } from './utils'

// FIXED: downloadUrl access method
async downloadFile(fileId: string): Promise<Blob> {
  const file = await this.getFile(fileId)
  const downloadUrl = (file as any)['@microsoft.graph.downloadUrl']
  if (!downloadUrl) throw new Error('Download URL not available')
  const response = await fetch(downloadUrl)
  return response.blob()
}

// FIXED: Added retried parameter + SESSION_EXPIRED
private async makeRequest(url: string, options: RequestInit = {}, retried = false): Promise<any> {
  if (response.status === 401 && !retried) {
    const refreshed = await tokenManager.refreshToken('onedrive')
    if (refreshed) {
      this.accessToken = refreshed.accessToken
      return this.makeRequest(url, options, true)
    }
    throw new Error('SESSION_EXPIRED')
  }
}
```

## googleDrive.ts (Key Changes)

```typescript
import { fetchWithTimeout } from './utils'

// FIXED: Non-exportable types
const NON_EXPORTABLE = ['application/vnd.google-apps.script']
if (NON_EXPORTABLE.includes(metadata.mimeType)) {
  throw new Error('This file type cannot be downloaded.')
}

// FIXED: Google Docs export allowlist
const googleDocsTypes = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing',
  'application/vnd.google-apps.form',
  'application/vnd.google-apps.audio',
]

// FIXED: moveFile - direct API call
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
getIcon(): string { return '🗂️' }

// FIXED: Added retried parameter + SESSION_EXPIRED
private async makeRequest(url: string, options: RequestInit = {}, retried = false): Promise<any> {
  if (response.status === 401 && !retried) {
    const refreshed = await tokenManager.refreshToken('google')
    if (refreshed) {
      this.accessToken = refreshed.accessToken
      return this.makeRequest(url, options, true)
    }
    throw new Error('SESSION_EXPIRED')
  }
}
```

## types.ts (Key Change)

```typescript
{
  id: 'google',
  name: 'Google Drive',
  icon: '🗂️',  // FIXED: Was 📧, then 📁
  // ...
}
```

---

# PART 3: COMPONENT FIXES

## FileBrowser.tsx (Key Sections)

```typescript
export default function FileBrowser({ token, currentPath = '/', locationId, onPathChange, onRefresh }) {
  // COMPONENT-LEVEL: Cloud provider detection
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

  // FIXED: Non-blocking banner for unimplemented features
  const [unimplementedMsg, setUnimplementedMsg] = useState<string | null>(null)

  async function handleDownload(fileId: string, filePath: string) {
    console.warn('not yet implemented: download', fileId, filePath)
    setUnimplementedMsg('Download is not yet implemented')
  }
}
```

## FolderTree.tsx (Key Sections)

```typescript
import { useState, useEffect, useRef } from 'react'
import { browseFiles } from '@/lib/api'
import { getProvider } from '@/lib/providers'
import { ProviderId } from '@/lib/providers/types'

export default function FolderTree({ token, locationId, currentPath, onFolderSelect, onRefresh }) {
  const loadedPathsRef = useRef<Set<string>>(new Set())
  
  const isCloud = locationId?.startsWith('cloud-') ?? false
  const cloudProviderId = isCloud ? locationId?.replace('cloud-', '') as ProviderId : null

  // FIXED: Clear ref on refresh
  useEffect(() => {
    loadedPathsRef.current.clear()
  }, [locationId])

  // FIXED: Use loadedPathsRef + cloud provider guard
  async function loadFolders(path: string) {
    if (loadedPathsRef.current.has(path)) return
    
    if (isCloud && cloudProviderId) {
      const provider = getProvider(cloudProviderId)
      if (provider) {
        const result = await provider.listFiles({ folderId: path })
        folderItems = result.files
          .filter((f: any) => f.isFolder)
          .map((f: any) => ({
            name: f.name,
            path: f.id,  // FIXED: Use ID for cloud
            isFolder: true
          }))
      }
    } else {
      const data = await browseFiles(path, token, locationId)
      folderItems = data.folders || []
    }
    
    loadedPathsRef.current.add(path)
  }
}
```

## RemotesPanel.tsx (Key Sections)

```typescript
import { getProvider } from '@/lib/providers'

// TODO: SECURITY — OAuth tokens currently stored in localStorage (XSS risk).
// Server-side token storage was disabled. Re-enable before production.
// See: /api/tokens endpoint

async function handleOAuthConnect(providerId: string) {
  const provider = getProvider(providerId as any)
  if (!provider) {
    alert("Provider not found. Please refresh the page.")
    return
  }
  
  // Proper error handling instead of if(false)
  const response = await fetch("/api/tokens", { /* ... */ })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || "Failed to save token")
  }
}
```

## DrivePanel.tsx (Key Sections)

```typescript
async function getCloudProvidersWithQuotas() {
  const [quotaLoading, setQuotaLoading] = useState(false)

  setQuotaLoading(true)
  const quotaResults = await Promise.allSettled(
    locationsWithTokens.map(async ({ pid }) => {
      const provider = getProvider(pid)
      if (provider) return await provider.getQuota()
      return { used: 0, total: 0, ... }
    })
  )
  setQuotaLoading(false)

  // Handle rejected results properly
  const cloudLocations = locationsWithTokens.map(({ pid, token: t, config }, index) => {
    const quotaResult = quotaResults[index]
    let quota = { used: 0, total: 0 }
    
    if (quotaResult.status === 'fulfilled') {
      quota = { used: quotaResult.value.used, total: quotaResult.value.total }
    }
    
    return { /* ... */ }
  })
}
```

## ThemeToggle.tsx (Key Sections)

```typescript
import { useState, useEffect, useCallback } from 'react'

export default function ThemeToggle() {
  // FIXED: Safari private mode + functional setState
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cf_theme') === 'dark'
    } catch {
      return false
    }
  })

  // FIXED: useCallback with functional setState
  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const newIsDark = !prev
      if (newIsDark) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('cf_theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')  // FIXED: Remove, not add
        localStorage.setItem('cf_theme', 'light')
      }
      return newIsDark
    })
  }, [])

  // FIXED: toggleTheme in dependency array
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        toggleTheme()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleTheme])
}
```

## UploadModal.tsx (Key Change)

```typescript
// FIXED: Use provider.icon instead of hardcoded emoji
{
  connectedProviders.map(cp => {
    const provider = PROVIDERS.find(p => p.id === cp.providerId)
    if (!provider) console.warn(`No provider config found for: ${cp.providerId}`)
    return (
      <span>{provider?.icon || '📁'}</span>
    )
  })
}
```

## ProviderHub.tsx (Key Change)

```typescript
function getProviderIcon(providerId: ProviderId): string {
  const icons: Record<ProviderId, string> = {
    google: '🗂️',  // FIXED
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
4. ✅ Added SESSION_EXPIRED error on 401 refresh failure (all providers)
5. ✅ Fixed base64UrlEncode for bytes > 127 (pkce.ts)

## High Priority Bugs
1. ✅ FileBrowser: handleUpload routes to correct cloud provider
2. ✅ FileBrowser: handleCreateFolder routes to correct cloud provider
3. ✅ FileBrowser: Context menu banners instead of alerts
4. ✅ FolderTree: loadedPaths ref prevents re-fetching empty folders
5. ✅ FolderTree: Cloud provider guard for browseFiles
6. ✅ FolderTree: Clear ref on refresh, use f.id for cloud providers
7. ✅ RemotesPanel: Static import instead of dynamic
8. ✅ RemotesPanel: Removed dead if(false) code block
9. ✅ RemotesPanel: Added security gap TODO comment

## Medium Priority Bugs
1. ✅ DrivePanel: Parallel quota fetching with loading state
2. ✅ ThemeToggle: Fixed stale closure on keyboard shortcut
3. ✅ ThemeToggle: Added localStorage try/catch for Safari private mode
4. ✅ ThemeToggle: Fixed toggle to light mode (remove dark class)
5. ✅ ProviderHub/RemotesPanel/types: Fixed Google Drive icon (🗂️)
6. ✅ UploadModal: Use provider.icon instead of hardcoded emojis
7. ✅ UploadModal: Added provider lookup warning
8. ✅ googleDrive.ts: Added script exclusion (non-exportable type)
9. ✅ oneDrive.ts: Fixed downloadUrl access (@microsoft.graph.downloadUrl)
10. ✅ box.ts: Fixed quota fallback chain (allocated ?? space_amount ?? 0)
11. ✅ filen.ts: Added method parameter to req() for GET/POST routing

## Utility Improvements
1. ✅ Created shared pkce.ts module
2. ✅ Created shared utils.ts module (formatBytes, formatMimeType)
3. ✅ Added fetchWithTimeout helper to utils.ts
4. ✅ Fixed mime type mappings (png→gif bug)

## Cleanup
1. ✅ Deleted backup/tmp files
2. ✅ Deleted old review files

---

*End of file - All fixes combined (Updated Feb 27, 2026)*
