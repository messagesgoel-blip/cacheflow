# CacheFlow Development Roadmap

> Last Updated: Feb 28, 2026

---


## 2026 UI Improvement Cycle (5 Phases)

Source: `/srv/storage/screenshots/cacheflow_archive/cacheflow-ui-roadmap.docx` (March 2026 QA/Product review).

This cycle converts the doc's 4-phase proposal into 5 delivery phases so structural risk is isolated from bug/security trust fixes and rollout can be gated with QA at each stage.

### Phase 1: Critical Stabilization & Trust Corrections
Priority: Critical | Backend: Minor

Scope:
1. Fix Google Drive folder browser in Copy/Move modal (no false "No folders" state).
2. Fix transfer destination path rendering (`/ /Dest` double slash issue).
3. Correct Settings About architecture copy to reflect server-side proxy + encrypted token storage.
4. Add user-visible provider error surfacing consistency for degraded providers.
5. Verify live activity logging freshness (not stale/frozen windows).

Exit criteria:
1. Transfer modal folder browsing works for Google + Dropbox in prod-like runs.
2. No incorrect architecture claims in UI copy.
3. QA can reproduce provider error signals without ambiguous "connected" state.

### Phase 2: Structural Navigation Rebuild
Priority: Critical | Backend: No

Scope:
1. Replace toolbar dropdown navigation with persistent left sidebar tree.
2. Add sidebar hierarchy: All Files, Recent, Starred, Provider -> Account nodes.
3. Add collapsible sidebar rail behavior and persisted state.
4. Add main-pane breadcrumbs with click-up navigation.
5. Replace per-row icon wall with contextual selection/action toolbar and overflow menu.

Exit criteria:
1. Sidebar is the single source of navigation context.
2. Breadcrumb path always matches current folder context.
3. File list readability improves by removing dense always-visible action icons.

### Phase 3: Interaction Reliability & System Feedback
Priority: High | Backend: Yes

Scope:
1. Add drag-and-drop transfers across providers/folders (modal as fallback).
2. Add provider health checks with states: Connected / Degraded / Needs Re-auth.
3. Surface health indicators in Integrations and sidebar.
4. Add persistent transfer queue/progress panel with queued/in-progress/complete/failed states.

Exit criteria:
1. Users can start transfers via drag/drop or modal with identical outcomes.
2. Provider health reflects real status (no false "connected").
3. Long-running transfers remain visible and recoverable (retry path for failures).

### Phase 4: Information Architecture & Discoverability
Priority: High | Backend: Yes

Scope:
1. Add grouped default view for All Providers (with account/provider section headers).
2. Keep Flat view as optional mode and persist user preference.
3. Add global cross-provider search fan-out + merged ranked results.
4. Add per-account and aggregate quota visualization in sidebar.

Exit criteria:
1. Duplicate folder names are no longer interpreted as UI bugs in unified listing.
2. Global search returns merged results even if one provider fails.
3. Storage visibility reinforces core multi-cloud value proposition.

### Phase 5: Power-User Enhancements & Product Differentiation
Priority: Medium | Backend: Yes (partial)

Scope:
1. Add inline preview panel (image/text/pdf/xlsx metadata-aware preview).
2. Add full keyboard navigation + shortcuts for file manager workflows.
3. Add cross-provider Starred/Favorites metadata layer.
4. Add user-facing activity feed (per-user filtered operations timeline).
5. Complete visual language unification across File Browser, Integrations, and Admin surfaces.

Exit criteria:
1. Keyboard-only flow covers core file operations.
2. Preview, favorites, and activity history work cross-provider without context loss.
3. Shared design system tokens are consistently applied across major screens.

### QA Gate for Each Phase
1. Add phase-specific Playwright specs before merge.
2. Record screenshots + JSON report per phase run in `/srv/storage/screenshots/cacheflow`.
3. Require zero console/page errors for sign-off.


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
