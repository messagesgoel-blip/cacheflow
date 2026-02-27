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
- Removed `client_secret` from browser-side OAuth (box.ts)
- Moved tokens from URL query params to Authorization headers (filen.ts, pcloud.ts)
- Added `retried` parameter to prevent infinite 401 loops
- Added SESSION_EXPIRED error propagation

### Component Fixes
- FileBrowser: Cloud upload/folder creation routing
- FolderTree: Prevent re-fetching empty folders
- ThemeToggle: Stale closure fix, Safari private mode support
- DrivePanel: Parallel quota fetching
- RemotesPanel: Static imports, dead code removal
- UploadModal: Provider icon fixes

### Provider Fixes
- pkce.ts: Fixed base64UrlEncode for bytes > 127
- utils.ts: Added fetchWithTimeout helper
- googleDrive.ts: Script exclusion, icon fix
- oneDrive.ts: downloadUrl fix
- box.ts: Quota fallback chain
- filen.ts: Method parameter, SESSION_EXPIRED

---

For detailed code changes, see `code.md` or `latest-code-after-fixes.md`.
For component changes, see `components.md`.
