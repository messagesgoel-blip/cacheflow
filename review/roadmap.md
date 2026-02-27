# CacheFlow Bug Fixes - Roadmap

## Completed Fixes Summary

### HIGH PRIORITY

1. **FileBrowser.tsx** - `handleUpload` always routes to local API
   - ✅ Fixed: Hoisted `isCloud` and `providerId` as component-level constants
   - ✅ Fixed: Added cloud branch in `handleUpload` to call provider.uploadFile()
   - ✅ Fixed: Added cloud branch in `handleCreateFolder` to call provider.createFolder()
   - ✅ Fixed: Context menu stubs now show alerts instead of silent console.log

2. **FolderTree.tsx** - Re-fetches empty folders on every path change
   - ✅ Fixed: Added `loadedPathsRef` to track loaded paths
   - ✅ Fixed: `ensureFolderLoaded` now checks the ref before fetching
   - ✅ Fixed: Added cloud provider guard - calls `provider.listFiles()` for cloud- prefixed locationId

3. **RemotesPanel.tsx** - Dynamic imports causing slowness
   - ✅ Fixed: Replaced dynamic `import("@/lib/providers")` with static import
   - ✅ Fixed: Removed `if (false)` dead code block, added proper error handling

### MEDIUM PRIORITY

4. **DrivePanel.tsx** - Provider cards show 0 quota
   - ✅ Fixed: Changed to parallel `Promise.allSettled` for quota fetching
   - ✅ Fixed: Added `quotaLoading` state for loading indicator

5. **ThemeToggle.tsx** - Stale closure on keyboard shortcut
   - ✅ Fixed: Used `useCallback` with functional setState to avoid stale closure

6. **ProviderHub.tsx + RemotesPanel.tsx** - Wrong Google Drive icon
   - ✅ Fixed: Changed 📧 to 🗂️ in getProviderIcon and CLOUD_PROVIDERS

7. **UploadModal.tsx** - Fragile hardcoded emoji
   - ✅ Fixed: Changed to use `provider?.icon` from PROVIDERS config

8. **FileTable.tsx** - Verify rename server contract
   - ✅ Verified: Comment already correct - server handles path reconstruction

### LOW PRIORITY / CLEANUP

9. **Security Fixes** (box.ts, filen.ts, pcloud.ts)
   - ✅ Removed client_secret from browser-side OAuth code
   - ✅ Moved tokens from URL query params to Authorization headers
   - ✅ Added retried parameter to prevent infinite 401 loops

10. **Shared Utilities**
    - ✅ Created `web/lib/providers/pkce.ts` - PKCE helpers
    - ✅ Created `web/lib/providers/utils.ts` - formatBytes + formatMimeType

11. **Deleted Files**
    - ✅ Deleted `RemotesPanel.tsx.backup` and `.tmp`
    - ✅ Deleted `ThemeToggle.tsx.bak`

## Files Changed

### Components Modified
- `web/components/DrivePanel.tsx`
- `web/components/FileBrowser.tsx`
- `web/components/FileTable.tsx`
- `web/components/FolderTree.tsx`
- `web/components/ProviderHub.tsx`
- `web/components/RemotesPanel.tsx`
- `web/components/ThemeToggle.tsx`
- `web/components/UploadModal.tsx`

### Providers Modified
- `web/lib/providers/box.ts`
- `web/lib/providers/dropbox.ts`
- `web/lib/providers/filen.ts`
- `web/lib/providers/googleDrive.ts`
- `web/lib/providers/oneDrive.ts`
- `web/lib/providers/pcloud.ts`
- `web/lib/providers/types.ts`
- `web/lib/providers/vps.ts`
- `web/lib/providers/webdav.ts`
- `web/lib/providers/yandex.ts`

### New Files
- `web/lib/providers/pkce.ts`
- `web/lib/providers/utils.ts`

## Next Steps

1. Test all cloud provider OAuth flows
2. Verify upload/download works for each provider
3. Test folder navigation in FolderTree for cloud providers
4. Verify theme toggle keyboard shortcut works
