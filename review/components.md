# Code Review - Web Component Changes

## FileBrowser.tsx

### Fix 1: Cloud provider detection moved to component scope

**Before:** Computed inside `loadCurrentPath()` - causes stale closure issues
```typescript
async function loadCurrentPath() {
  const isCloud = locationId?.startsWith('cloud-') ?? false
  const providerId = isCloud ? locationId?.replace('cloud-', '') as ProviderId : null
```

**After:** Hoisted to component level
```typescript
const isCloud = locationId?.startsWith('cloud-') ?? false
const cloudProviderId = isCloud ? locationId?.replace('cloud-', '') as ProviderId : null
```

### Fix 2: handleUpload routes to correct provider

```typescript
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
```

### Fix 3: handleCreateFolder routes to correct provider

```typescript
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
```

### Fix 4: Context menu stubs show banner instead of alert

**Before:** Silent console.log
```typescript
async function handleDownload(fileId: string, filePath: string) {
  console.log('Download file:', fileId, filePath) // Silent!
}
```

**After:** Non-blocking banner
```typescript
const [unimplementedMsg, setUnimplementedMsg] = useState<string | null>(null)

async function handleDownload(fileId: string, filePath: string) {
  console.warn('not yet implemented: download', fileId, filePath)
  setUnimplementedMsg('Download is not yet implemented')
}

// Render:
{unimplementedMsg && (
  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 flex justify-between items-center">
    <span>{unimplementedMsg}</span>
    <button onClick={() => setUnimplementedMsg(null)}>×</button>
  </div>
)}
```

---

## FolderTree.tsx

### Fix 1: Prevent re-fetching empty folders

**Problem:** Empty folders have no children, so `hasChildren` was always false, causing re-fetch on every path change.

**Solution:** Use a ref to track loaded paths
```typescript
const loadedPathsRef = useRef<Set<string>>(new Set())

async function loadFolders(path: string) {
  if (loadedPathsRef.current.has(path)) return  // Skip if already loaded
  // ... fetch logic ...
  loadedPathsRef.current.add(path)
}

async function ensureFolderLoaded(path: string) {
  if (loadedPathsRef.current.has(path)) return
  await loadFolders(path)
}
```

### Fix 2: Clear ref on refresh
```typescript
onClick={() => {
  loadedPathsRef.current.clear()
  loadFolders('/')
  onRefresh?.()
}}
```

### Fix 3: Cloud provider guard

**Before:** Always called local browseFiles API
```typescript
const data = await browseFiles(path, token, locationId)
```

**After:** Check for cloud provider first
```typescript
if (isCloud && cloudProviderId) {
  const provider = getProvider(cloudProviderId)
  if (provider) {
    const result = await provider.listFiles({ folderId: path })
    folderItems = result.files
      .filter((f: any) => f.isFolder)
      .map((f: any) => ({
        name: f.name,
        path: f.id,  // Use ID for cloud providers
        isFolder: true
      }))
  }
} else {
  const data = await browseFiles(path, token, locationId)
  folderItems = data.folders || []
}
```

---

## RemotesPanel.tsx

### Fix 1: Static import instead of dynamic

**Before:** Slow dynamic import
```typescript
async function handleOAuthConnect(providerId: string) {
  const providers = await import("@/lib/providers")
  const getProvider = providers.getProvider
```

**After:** Static import
```typescript
import { getProvider } from '@/lib/providers'

async function handleOAuthConnect(providerId: string) {
  const provider = getProvider(providerId as any)
```

### Fix 2: Removed dead code

**Before:**
```typescript
if (false) { // Server save disabled
  const err = await response.json()
  throw new Error(err.error || "Failed to save token")
}
```

**After:** Proper error handling
```typescript
if (!response.ok) {
  const err = await response.json().catch(() => ({}))
  throw new Error(err.error || "Failed to save token")
}
```

### Fix 3: Google Drive icon

```typescript
// Changed from '📧' to '🗂️' in CLOUD_PROVIDERS array
```

### Fix 4: Security Gap Documentation

```typescript
// TODO: SECURITY — OAuth tokens currently stored in localStorage (XSS risk).
// Server-side token storage was disabled. Re-enable before production.
```

---

## DrivePanel.tsx

### Fix: Parallel quota fetching with loading state

**Before:** Sequential, no loading indicator
```typescript
for (const pid of providerIds) {
  const provider = getProvider(pid)
  quota = await provider.getQuota()  // Sequential!
}
```

**After:** Parallel with loading indicator
```typescript
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

// Handle rejected results:
if (quotaResult.status === 'fulfilled') {
  quota = { used: quotaResult.value.used, total: quotaResult.value.total }
}
```

---

## ThemeToggle.tsx

### Fix 1: Use useCallback with functional setState

**Before:** Stale closure bug
```typescript
const toggleTheme = () => {
  const newIsDark = !isDark  // Stale value!
  // ...
}
useEffect(() => {
  // toggleTheme not in dependency array
}, [isDark])
```

**After:** Stable callback
```typescript
const toggleTheme = useCallback(() => {
  setIsDark(prev => {
    const newIsDark = !prev
    if (newIsDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('cf_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('cf_theme', 'light')
    }
    return newIsDark
  })
}, [])

useEffect(() => {
  // ...
}, [toggleTheme])
```

### Fix 2: Safari private mode compatibility
```typescript
const [isDark, setIsDark] = useState<boolean>(() => {
  try {
    return localStorage.getItem('cf_theme') === 'dark'
  } catch {
    return false
  }
})
```

---

## UploadModal.tsx

### Fix: Use provider.icon instead of hardcoded emojis

**Before:**
```typescript
<span>{provider?.name === 'Google Drive' ? '📧' : provider?.name === 'OneDrive' ? '☁️' : '📁'}</span>
```

**After:**
```typescript
<span>{provider?.icon || '📁'}</span>

// Add warning for missing provider:
if (!provider) console.warn(`No provider config found for: ${cp.providerId}`)
```

---

## ProviderHub.tsx

### Fix: Google Drive icon

```typescript
function getProviderIcon(providerId: ProviderId): string {
  const icons: Record<ProviderId, string> = {
    google: '🗂️',  // Was: 📧
    // ...
  }
}
```

---

## Files Changed

| Component | Key Fix |
|-----------|---------|
| FileBrowser.tsx | Cloud upload/folder creation, context menu banners |
| FolderTree.tsx | loadedPaths ref, cloud provider guard, clear ref, use f.id |
| RemotesPanel.tsx | Static import, dead code removal, security gap TODO |
| DrivePanel.tsx | Parallel quota fetching, Promise.allSettled |
| ThemeToggle.tsx | useCallback, localStorage try/catch |
| UploadModal.tsx | Use provider.icon, provider warning |
| ProviderHub.tsx | Fix Google Drive icon |
