# CacheFlow Development Roadmap

> Last Updated: Feb 28, 2026

---

## Completed Features

### File Operations (Feb 28)
- ✅ Download - downloads file to device
- ✅ Share link - creates and copies share link to clipboard
- ✅ Rename - prompts for new name
- ✅ Delete - confirms and deletes file

### UI Improvements (Feb 28)
- ✅ Modern SVG icons for file actions (download, share, rename, delete)
- ✅ Folder navigation - click folders to navigate
- ✅ Removed "Local" from navbar - unified cloud-only view
- ✅ ShareDialog simplified - auto-creates link, auto-copies, no password required

### Provider Fixes (Feb 27-28)
- ✅ Google Drive file names - shows actual name not UUID
- ✅ Google Drive folder root - "/" converts to "root" for API
- ✅ Google Drive quota - uses usageInDrive field correctly
- ✅ TokenManager - added getConnectedProviders()
- ✅ ProviderHub OAuth - implemented connect flow

### Security Fixes (Earlier)
- ✅ Removed client_secret from browser OAuth
- ✅ Tokens in Authorization headers not URL params
- ✅ SESSION_EXPIRED error propagation
- ✅ Fixed base64UrlEncode for bytes > 127
- ✅ Token expiry set to 24 hours

---

## Current Issues (In Progress)

### Backend API Needed
- ❌ Download API (500 error) - needs /api/files/download endpoint
- ❌ Share API (500 error) - needs /api/share endpoint
- ❌ Rename API (500 error) - needs /api/files/rename endpoint
- ❌ Move API - needs implementation

### Known Issues
1. **localStorage tokens** - XSS risk, needs httpOnly cookies
2. **No CSRF protection** on API endpoints
3. **Type safety** - Some `(as any)` casts remain

---

## Next Steps

1. **Implement Backend APIs**
   - /api/files/download
   - /api/share
   - /api/files/rename
   - /api/files/move

2. **Test More Providers**
   - OneDrive
   - Dropbox
   - Box
   - pCloud
   - Filen
   - Yandex
   - SFTP/VPS

3. **Add SFTP Presets**
   - India server preset
   - OCI server preset

4. **Token Security**
   - Move to httpOnly cookies
   - Add CSRF protection

---

## Verification Commands

```bash
# Check for file action handlers
grep -n "handleFileDownload\|handleFileShare\|handleFileRename\|handleFileDelete" web/components/UnifiedFileBrowser.tsx

# Check token expiry
grep -n "24 \* 60 \* 60 \* 1000" web/lib/providers/googleDrive.ts

# Check navbar has no Local
grep "Local" web/components/Navbar.tsx
```
