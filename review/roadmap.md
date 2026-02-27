# CacheFlow Bug Fixes - Overview

> Last Updated: Feb 27, 2026

## Quick Reference

This directory contains detailed documentation of all bug fixes applied to CacheFlow.

| File | Description |
|------|-------------|
| `code.md` | Provider code changes (security fixes, API fixes) |
| `components.md` | Web component fixes (UI/UX fixes) |
| `latest-code-after-fixes.md` | Complete combined reference with all fixes |

---

## Summary of Fixes Applied

### Security Fixes
- ✅ Removed `client_secret` from browser-side OAuth (box.ts)
- ✅ Moved tokens from URL query params to Authorization headers (filen.ts, pcloud.ts)
- ✅ Added `retried` parameter to prevent infinite 401 loops
- ✅ Added SESSION_EXPIRED error propagation
- ✅ Fixed base64UrlEncode for bytes > 127 (pkce.ts)

### Component Fixes
- ✅ FileBrowser: Cloud upload/folder creation routing
- ✅ FileBrowser: Non-blocking banner for unimplemented features
- ✅ FolderTree: Prevent re-fetching empty folders (loadedPaths ref)
- ✅ FolderTree: Clear ref on refresh, use f.id for cloud
- ✅ ThemeToggle: Stale closure fix, Safari private mode support
- ✅ ThemeToggle: Fixed toggle to light mode (remove dark class)
- ✅ DrivePanel: Parallel quota fetching with loading state
- ✅ RemotesPanel: Static imports, dead code removal
- ✅ RemotesPanel: Security gap TODO comment
- ✅ UploadModal: Provider icon fixes + warning
- ✅ ProviderHub: Google Drive icon fix

### Provider Fixes
- ✅ pkce.ts: Fixed base64UrlEncode for bytes > 127
- ✅ utils.ts: Added fetchWithTimeout helper
- ✅ googleDrive.ts: Script exclusion, moveFile fix, icon
- ✅ oneDrive.ts: downloadUrl fix (@microsoft.graph.downloadUrl)
- ✅ box.ts: Quota fallback chain (allocated ?? space_amount ?? 0)
- ✅ filen.ts: Method parameter (GET/POST), SESSION_EXPIRED
- ✅ pcloud.ts: Token in header
- ✅ dropbox.ts: SESSION_EXPIRED
- ✅ types.ts: Google Drive icon 🗂️

---

## Files Changed

### Providers (web/lib/providers/)
| File | Status |
|------|--------|
| box.ts | ✅ Fixed |
| filen.ts | ✅ Fixed |
| pcloud.ts | ✅ Fixed |
| dropbox.ts | ✅ Fixed |
| oneDrive.ts | ✅ Fixed |
| googleDrive.ts | ✅ Fixed |
| types.ts | ✅ Fixed |
| vps.ts | ✅ Verified |
| webdav.ts | ✅ Verified |
| yandex.ts | ✅ Verified |
| pkce.ts | ✅ Created |
| utils.ts | ✅ Created |

### Components (web/components/)
| File | Status |
|------|--------|
| FileBrowser.tsx | ✅ Fixed |
| FolderTree.tsx | ✅ Fixed |
| RemotesPanel.tsx | ✅ Fixed |
| DrivePanel.tsx | ✅ Fixed |
| ThemeToggle.tsx | ✅ Fixed |
| UploadModal.tsx | ✅ Fixed |
| ProviderHub.tsx | ✅ Fixed |

---

## Verification Commands

```bash
# Should return 0 (no email emoji)
grep -r "📧" web/lib/providers/

# Should return 0 (no debug logs)
grep -r "console.log" web/lib/providers/

# Should show the light mode fix
grep "classList.remove.*dark" web/components/ThemeToggle.tsx

# Should show fetchWithTimeout exported
grep "export.*fetchWithTimeout" web/lib/providers/utils.ts

# Should show SESSION_EXPIRED errors
grep "SESSION_EXPIRED" web/lib/providers/*.ts
```

---

## Known Issues (Out of Scope)

1. **localStorage token storage** - XSS risk, needs httpOnly cookies before production
2. **No CSRF protection** on /api/tokens endpoint
3. **Context menu stubs** - Banners shown but functionality not implemented yet
4. **fetchWithTimeout** - Helper defined but not used in providers yet
5. **Type safety** - Some `(as any)` casts remain

---

For detailed code changes, see `code.md` or `latest-code-after-fixes.md`.
For component changes, see `components.md`.
