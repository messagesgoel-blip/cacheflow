# Code Review - Web Component Changes

## FileBrowser.tsx

### Fix 1: Cloud provider detection moved to component scope

**Before:** Computed inside `loadCurrentPath()` - causes stale closure issues
```typescript
async function loadCurrentPath() {
  // Computed inside function - stale closure bug!
  const isCloud = locationId?.startsWith('cloud-') ?? false
  const providerId = isCloud ? locationId?.replace('cloud-', '') as ProviderId : null
```

**After:** Hoisted to component level
```typescript
// Component-level derived values for cloud provider detection
const isCloud = locationId?.startsWith('cloud-') ?? false
const cloudProviderId = isCloud ? locationId?.replace('cloud-', '') as ProviderId : null
```

### Fix 2: handleUpload routes to correct provider

```typescript
async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
  // Handle cloud provider upload
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
  // Handle cloud provider folder creation
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

### Fix 4: Context menu stubs show alerts

**Before:** Silent console.log
```typescript
async function handleDownload(fileId: string, filePath: string) {
  console.log('Download file:', fileId, filePath) // Silent!
}
```

**After:** Visible warnings
```typescript
async function handleDownload(fileId: string, filePath: string) {
  console.warn('not yet implemented: download', fileId, filePath)
  alert('Download is not yet implemented')
}
```

---

## FolderTree.tsx

### Fix 1: Prevent re-fetching empty folders

**Problem:** Empty folders have no children, so `hasChildren` was always false, causing re-fetch on every path change.

**Solution:** Use a ref to track loaded paths
```typescript
const loadedPathsRef = useRef<Set<string>>(new Set())

async function loadFolders(path: string) {
  // Skip if already loaded
  if (loadedPathsRef.current.has(path)) {
    return
  }
  // ... fetch logic ...
  loadedPathsRef.current.add(path)
}

async function ensureFolderLoaded(path: string) {
  // Skip if already loaded
  if (loadedPathsRef.current.has(path)) {
    return
  }
  await loadFolders(path)
}
```

### Fix 2: Cloud provider guard

**Before:** Always called local browseFiles API
```typescript
const data = await browseFiles(path, token, locationId)
```

**After:** Check for cloud provider first
```typescript
// Handle cloud provider
if (isCloud && cloudProviderId) {
  const provider = getProvider(cloudProviderId)
  if (provider) {
    const result = await provider.listFiles({ folderId: path })
    folderItems = result.files
      .filter((f: any) => f.isFolder)
      .map((f: any) => ({ name: f.name, path: f.path, isFolder: true }))
  }
} else {
  // Handle local storage
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
  const providers = await import("@/lib/providers")  // SLOW!
  const getProvider = providers.getProvider
```

**After:** Static import
```typescript
import { getProvider } from '@/lib/providers'

async function handleOAuthConnect(providerId: string) {
  const provider = getProvider(providerId as any)  // FAST!
```

### Fix 2: Removed dead code

**Before:**
```typescript
if (false) { // Server save disabled - token in localStorage
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

// Fetch quotas in parallel
setQuotaLoading(true)
const quotaResults = await Promise.allSettled(
  locationsWithTokens.map(async ({ pid }) => {
    const provider = getProvider(pid)
    if (provider) return await provider.getQuota()
    return { used: 0, total: 0, ... }
  })
)
setQuotaLoading(false)
```

---

## ThemeToggle.tsx

### Fix: Stale closure on keyboard shortcut

**Before:** toggleTheme not in dependency array
```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
      toggleTheme()  // Stale isDark value!
    }
  }
  window.addEventListener('keydown', handleKeyDown)
}, [isDark])  // Missing toggleTheme
```

**After:** Use useCallback with functional setState
```typescript
const toggleTheme = useCallback(() => {
  setIsDark(prev => {
    const newIsDark = !prev
    // Use prev instead of isDark - no stale closure!
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

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
      toggleTheme()  // Now uses stable callback
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [toggleTheme])  // Now includes toggleTheme
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
```

---

## ProviderHub.tsx

### Fix: Google Drive icon

```typescript
function getProviderIcon(providerId: ProviderId): string {
  const icons: Record<ProviderId, string> = {
    google: '🗂️',  // Was: '📧'
    // ...
  }
}
```

---

## Files Changed

| Component | Key Fix |
|-----------|---------|
| FileBrowser.tsx | Cloud upload/folder creation, context menu alerts |
| FolderTree.tsx | loadedPaths ref, cloud provider guard |
| RemotesPanel.tsx | Static import, removed dead code |
| DrivePanel.tsx | Parallel quota fetching |
| ThemeToggle.tsx | useCallback for stale closure |
| UploadModal.tsx | Use provider.icon |
| ProviderHub.tsx | Fix Google Drive icon |
