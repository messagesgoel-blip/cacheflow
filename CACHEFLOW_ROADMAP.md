# CacheFlow Roadmap — Client-Side OAuth Architecture

**Version:** 3.0 (Revised)
**Status:** Implementation Ready
**Generated:** 2026-02-26
**Architecture:** Hybrid OAuth (Browser + Optional Server Storage)
**Changes from v2:** Added VPS/SFTP provider, PWA support, document preview, rebalanced provider schedule

---

## What Changed from v2

| Area | v2 | v3 Change |
|---|---|---|
| Provider schedule | 11 adapters in Week 2 | Split into Week 2a (core 3), Week 2b (next 3), Week 3a (specialist 3 + VPS) |
| VPS/SFTP | Not in plan | Added as Week 2b provider with server-side SFTP proxy |
| PWA | Not mentioned | Added to Week 1 alongside UI foundation |
| Document preview | Not mentioned | Added to Phase 6 — Google Docs viewer + Monaco Editor |
| OAuth registration | Not mentioned | Added as prerequisite checklist before Week 2 |


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

## Architecture Overview

### Hybrid Token Storage

| Mode | Token Storage | Use Case |
|---|---|---|
| **Default** | Browser localStorage (primary) + Server encrypted (backup) | Convenience, faster re-login |
| **Privacy** | Browser localStorage only | Privacy-focused users |

- Server tokens are **encrypted** with AES-256 before storage
- User can toggle "Browser-only mode" in settings
- Background sync uses server tokens (if mode = default)
- **VPS/SFTP credentials always stored server-side** (encrypted) — SSH protocol cannot be browser-native

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            BROWSER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌───────────────────────┐  │
│  │   Provider  │     │    Cache     │     │   Transfer Manager    │  │
│  │   Adapters  │◄───►│  (IndexedDB) │     │   (Browser-mediated)  │  │
│  │  (Google,   │     │  - Metadata  │     │   - Download → Upload │  │
│  │   OneDrive, │     │  - File list │     │   - Progress tracking │  │
│  │   Dropbox,  │     │  - Cache TTL │     │   - Never touches     │  │
│  │   VPS↓proxy)│     │              │     │     server disk       │  │
│  └──────────────┘     └──────────────┘     └───────────────────────┘  │
│         ▲                     ▲                          ▲              │
│         │                     │                          │              │
│  ┌──────┴─────────────────────┴──────────────────────────┴──────────┐  │
│  │                    TOKEN MANAGER                                  │  │
│  │  - localStorage: access_token, refresh_token, expires_at         │  │
│  │  - Server sync (optional): encrypted tokens via API               │  │
│  │  - browserOnly mode toggle                                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              SERVER                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  ┌──────────────┐ │
│  │   Metadata   │  │    Token     │  │   SFTP    │  │  Transfer    │ │
│  │    Cache     │  │   Storage    │  │   Proxy   │  │  Progress    │ │
│  │  - File list │  │ (Encrypted)  │  │ (VPS only)│  │  Tracking   │ │
│  │  - Quota     │  │ - Optional   │  │ - ssh2 npm│  │  Only       │ │
│  │  - Health    │  │ - Per-user   │  │ - Streams │  │  No persist │ │
│  └──────────────┘  └──────────────┘  └───────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Pre-Week Prerequisites

### OAuth App Registrations (Do Before Week 2)

These take time to approve — register them during Week 1 while building UI:

| Provider | Registration URL | Time to Approve | Notes |
|---|---|---|---|
| Google Drive | console.cloud.google.com → APIs → Drive API → Credentials | Instant (dev), 1–2 weeks (production verification) | Use localhost for dev, add production domain later |
| Microsoft OneDrive | portal.azure.com → App registrations | Instant | Multi-tenant, set redirect to your domain |
| Dropbox | dropbox.com/developers/apps | Instant | PKCE flow, set redirect URI |
| Box | developer.box.com | Instant | OAuth2 PKCE |
| pCloud | docs.pcloud.com | Instant | Manual PKCE, no SDK |
| Filen | No registration needed | — | API key from account settings |
| Yandex | oauth.yandex.com | Instant | |
| DeepInfra (VPS test) | — | — | No OAuth, uses SSH key |

**Action:** Register Google + Microsoft on Day 1 of Week 1. Register others during Week 1. Have all client IDs ready before Week 2 starts.

---

## Phase 1: UI Foundation + PWA (Week 1)

### 1.1 Provider Types & Mock Data

**Goal:** Define types and create mock providers for UI development

**New Files:**
- `web/lib/providers/types.ts` — TypeScript interfaces
- `web/lib/providers/mockProviders.ts` — Mock implementations for testing UI
- `web/lib/providers/index.ts` — Base types and interfaces
- `web/lib/providers/StorageProvider.ts` — Abstract base class

**Interface:**
```typescript
interface StorageProvider {
  id: string
  name: string
  icon: string
  color: string
  freeStorageGB: number
  requiresServerProxy: boolean  // true for VPS/SFTP only

  // Auth
  connect(): Promise<ProviderToken>
  disconnect(): Promise<void>
  refreshToken(token: ProviderToken): Promise<ProviderToken>

  // Quota
  getQuota(): Promise<{ used: number; total: number }>

  // Files
  listFiles(folderId?: string): Promise<FileMetadata[]>
  searchFiles(query: string): Promise<FileMetadata[]>
  uploadFile(file: File, folderId?: string, onProgress?: (pct: number) => void): Promise<FileMetadata>
  downloadFile(fileId: string): Promise<Blob>
  deleteFile(fileId: string): Promise<void>
  getShareLink(fileId: string): Promise<string | null>
}
```

**Deliverable:** All future provider implementations follow this interface. Mock providers available for all 9 providers (8 cloud + VPS).

---

### 1.2 Token Manager (Browser)

**Goal:** Unified token storage with localStorage + optional server sync

**New Files:**
- `web/lib/tokenManager.ts` — Core token management
- `web/lib/providers/tokenStorage.ts` — localStorage wrapper

**Features:**
- Store tokens in `localStorage` keyed by provider: `cacheflow_token_${provider}`
- Token structure: `{ accessToken, refreshToken, expiresAt, accountEmail, displayName }`
- Auto-refresh before expiry (5 min buffer)
- Methods: `saveToken()`, `getToken()`, `removeToken()`, `isTokenValid()`
- VPS credentials excluded from browser storage — always server-side only

**Deliverable:** Tokens persist in browser, auto-refresh works

---

### 1.3 Server Token Endpoints (Optional Storage)

**Goal:** Enable optional server token storage for convenience

**Modify Files:**
- `api/src/routes/tokens.js` — NEW endpoint for token CRUD

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tokens` | Save encrypted token (user provides encrypted blob) |
| GET | `/api/tokens` | Get user's stored tokens (encrypted) |
| DELETE | `/api/tokens/:provider` | Remove stored token |
| PATCH | `/api/tokens/:provider` | Update token |

**Database:**
- `migrations/006_oauth_tokens.sql` — ALREADY EXISTS (keep as-is)
- Add column: `user_preference` (default: 'server', options: ['server', 'browser_only'])

**Deliverable:** Server can store/retrieve encrypted tokens

---

### 1.4 User Settings: Browser-Only Toggle

**Goal:** Let users opt-out of server token storage

**New Files:**
- `web/components/SettingsPanel.tsx` — Settings UI

**Settings Options:**
```typescript
interface UserSettings {
  browserOnlyMode: boolean   // default: false (server storage enabled)
  autoRefreshTokens: boolean // default: true
  cacheTTLMinutes: number    // default: 5
}
```

**Deliverable:** User can toggle browser-only mode

---

### 1.5 PWA Manifest + Service Worker 🆕

**Goal:** Make CacheFlow installable on mobile and desktop. Fixes MultCloud's #1 complaint. One afternoon of work.

**New Files:**
- `web/public/manifest.json` — PWA manifest
- `web/public/sw.js` — Service worker (or use next-pwa if on Next.js)
- `web/public/icons/` — App icons at 192x192 and 512x512

**manifest.json:**
```json
{
  "name": "CacheFlow",
  "short_name": "CacheFlow",
  "description": "All your cloud storage in one place",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f0f0f",
  "theme_color": "#0f0f0f",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**If using Next.js — use next-pwa:**
```bash
npm install next-pwa
```

```js
// next.config.js
const withPWA = require('next-pwa')({ dest: 'public', disable: process.env.NODE_ENV === 'development' })
module.exports = withPWA({ /* existing config */ })
```

**Service worker caches:**
- App shell (HTML, CSS, JS)
- Provider icons and UI assets
- Last known file listing (stale-while-revalidate)
- Does NOT cache file content

**Deliverable:** CacheFlow shows "Add to Home Screen" on Android Chrome + iOS Safari. Works offline for cached views. Installable as desktop PWA.

---

### 1.6 Dashboard UI (Shell)

**Goal:** Build all UI shells with mock data before real providers exist

**New/Modify Files:**
- `web/components/Dashboard.tsx` — Combined storage view with mock data
- `web/components/RemotesPanel.tsx` — Provider hub with mock providers
- `web/components/FileBrowser.tsx` — File browser with mock files
- `web/components/SearchBar.tsx` — Search UI
- `web/components/StorageUpsell.tsx` — Get more storage panel

**Deliverable:** Complete UI navigable with mock data. No real provider calls yet.

---

## Phase 2a: Core Providers (Week 2 — first half)

**Priority order:** Google Drive + OneDrive first — these cover 20GB and have the best SDKs.

### 2.1 Google Drive Adapter

**Goal:** Full Google Drive integration using client-side OAuth

**New Files:**
- `web/lib/providers/googleDrive.ts`

**Dependencies:**
- Google Identity Services: `https://accounts.google.com/gsi/client`

**Flow:**
1. User clicks "Connect Google Drive"
2. Popup opens with Google OAuth (GIS token model)
3. On success: tokens stored in localStorage via TokenManager
4. Optionally sync to server (if not browser-only mode)

**Scopes:**
```
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/drive.metadata.readonly
```

**Deliverable:** Google Drive connect/disconnect, file listing, upload, download, quota

---

### 2.2 OneDrive Adapter

**Goal:** Full OneDrive integration using client-side OAuth

**New Files:**
- `web/lib/providers/oneDrive.ts`

**Dependencies:**
- `@azure/msal-browser` — Microsoft Authentication Library

**Scopes:**
```
Files.ReadWrite.All
offline_access
```

**Deliverable:** OneDrive connect/disconnect, file listing, upload, download, quota

---

### 2.3 WebDAV Adapter (Generic)

**Goal:** Support generic WebDAV servers (Nextcloud, ownCloud, Yandex, etc.)

**New Files:**
- `web/lib/providers/webdav.ts`

**Dependencies:**
- `webdav` — WebDAV client library

**Note:** WebDAV requires server-side CORS proxy for browser requests. Wire through existing Express backend at `POST /api/webdav-proxy`.

**Auth:**
- Basic auth (username/password)
- Bearer token (for Nextcloud)

**Deliverable:** Connect to any WebDAV server. Covers Nextcloud, ownCloud, Yandex Disk (WebDAV mode), and any self-hosted WebDAV.

---

## Phase 2b: Extended Providers (Week 2 — second half)

### 2.4 Dropbox Adapter

**New Files:** `web/lib/providers/dropbox.ts`
**Dependencies:** `dropbox` — Official Dropbox JavaScript SDK
**Auth:** PKCE OAuth2
**Scopes:** `files.content.read files.content.write account_info.read`
**Free tier:** 2 GB

---

### 2.5 Box Adapter

**New Files:** `web/lib/providers/box.ts`
**Dependencies:** Manual OAuth PKCE (Box JS SDK is Node-only)
**Auth:** OAuth2 PKCE popup
**Scopes:** `root_readwrite`
**Free tier:** 10 GB

---

### 2.6 VPS / SFTP Adapter 🆕

**Goal:** Connect any Linux VPS or dedicated server as a storage provider. Unique differentiator — no competitor supports this.

**Why different from cloud providers:** SFTP uses the SSH protocol which cannot be executed in a browser. This is the one provider that requires a server-side proxy. All file content still streams through without persisting on OCI disk.

**New Files:**
- `web/lib/providers/sftp.ts` — Browser-side adapter (calls CacheFlow API)
- `api/src/routes/sftp.js` — Server-side SFTP proxy
- `api/src/services/sftpService.ts` — SFTP connection pool
- `migrations/007_vps_connections.sql` — VPS credentials storage

**Dependencies (server-side):**
- `ssh2` — Node.js SSH2/SFTP client

**Connection UI:**
```typescript
interface VPSConnection {
  displayName: string    // e.g. "My OCI Server", "Hetzner VPS"
  host: string           // IP or hostname
  port: number           // default 22
  username: string       // e.g. ubuntu, sanjay
  authType: 'password' | 'key'
  credential: string     // password or private key (PEM)
  rootPath: string       // default '/'
}
```

**Database:**
```sql
CREATE TABLE vps_connections (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  display_name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER DEFAULT 22,
  username TEXT NOT NULL,
  auth_type TEXT CHECK (auth_type IN ('password', 'key')),
  credentials_enc BYTEA NOT NULL,  -- AES-256 encrypted, never plaintext
  root_path TEXT DEFAULT '/',
  status TEXT DEFAULT 'connected',
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**API Endpoints:**
| Method | Path | Description |
|---|---|---|
| POST | `/api/sftp/connect` | Test connection + save credentials |
| GET | `/api/sftp/:id/files` | List files via SFTP |
| GET | `/api/sftp/:id/quota` | Run `df -h` via SSH, return used/total |
| POST | `/api/sftp/:id/upload` | Stream upload to VPS |
| GET | `/api/sftp/:id/download/:path` | Stream download from VPS |
| DELETE | `/api/sftp/:id/file/:path` | Delete file on VPS |
| DELETE | `/api/sftp/:id` | Remove VPS connection |

**SFTP Proxy Implementation Notes:**
- Use `ssh2` npm package for SFTP sessions
- Connection pool: keep connections alive for 5 min, then close
- All file content streams through Express — never written to OCI disk
- Quota: `exec('df -h /')` via SSH, parse stdout
- Credentials decrypted in memory only, never logged

**Security:**
- Credentials encrypted with AES-256-GCM before PostgreSQL storage
- Encryption key from `process.env.CREDENTIAL_ENCRYPTION_KEY`
- Private keys never returned to browser after initial save
- All SFTP operations authenticated via CacheFlow JWT first

**Provider card UI:**
- Shows server hostname, used/total disk, last connected timestamp
- SSH key fingerprint shown after first connection for verification
- "Test connection" button before saving

**Deliverable:** Users can connect any Linux VPS, browse files, upload/download/delete, see disk quota. VPS appears in unified file browser alongside cloud providers.

---

## Phase 3a: Specialist Providers (Week 3 — first half)

### 3.1 pCloud Adapter

**New Files:** `web/lib/providers/pcloud.ts`
**Auth:** Manual OAuth2 PKCE (no JS SDK)
**Free tier:** 10 GB
**Affiliate:** `https://partner.pcloud.com/?ref=cacheflow`

---

### 3.2 Filen Adapter

**New Files:** `web/lib/providers/filen.ts`
**Dependencies:** `@filen/sdk`
**Note:** E2E encrypted — tokens and keys stay client-side entirely. Server-only mode not applicable.
**Free tier:** 10 GB
**Affiliate:** `https://filen.io/?ref=cacheflow`

---

### 3.3 Yandex Disk Adapter

**New Files:** `web/lib/providers/yandex.ts`
**Auth:** OAuth2 or WebDAV mode (use WebDAV adapter if OAuth is blocked by region)
**Scopes:** `cloud_api:disk.read cloud_api:disk.write`
**Free tier:** 10 GB

---

## Phase 3b: Integration & Data (Week 3 — second half)

### 3.4 Provider Aggregation

**Goal:** Merge file listings from all providers into single view

**Modify Files:**
- `web/components/FileBrowser.tsx` — Add provider aggregation
- `web/lib/fileAggregator.ts` — NEW: Merge files from all providers

**Features:**
- Unified file list sorted by modified date
- Provider indicator: color dot + icon on each row
- Filter by provider (including VPS)
- Virtual scrolling for large lists
- Duplicate badge: yellow indicator on files present on 2+ providers

**Deliverable:** Single view showing files from all connected providers including VPS

---

### 3.5 Cross-Provider Copy/Move

**Goal:** Copy and move files between any two providers including VPS

**Modify Files:**
- `web/lib/transferManager.ts` — Cross-provider transfer engine

**Flow:**
1. User right-clicks file → "Copy to..." or "Move to..."
2. Provider picker modal shows all connected providers + free space
3. Browser-mediated: download from source → upload to target
4. For VPS source/target: proxied through SFTP API, still streamed not persisted
5. Progress bar in UI
6. Move: delete source only after successful upload confirmed

**Transfer Interface:**
```typescript
interface TransferJob {
  id: string
  sourceProvider: string
  targetProvider: string
  sourceFileId: string
  targetPath: string
  status: 'pending' | 'transferring' | 'completed' | 'failed'
  progress: number // 0-100
  error?: string
}
```

**Deliverable:** Copy/move files between any two providers including VPS ↔ cloud

---

### 3.6 Metadata Cache (IndexedDB)

**Goal:** Cache file listings to avoid re-fetching

**New Files:**
- `web/lib/metadataCache.ts` — IndexedDB wrapper

**Cache Strategy:**
- TTL: 5 minutes for active providers, 30 minutes for inactive
- Manual refresh button per provider
- Auto-refresh on folder navigation
- VPS cached same as cloud providers

**Deliverable:** Fast file browser, reduced API calls

---

### 3.7 Token Sync with Server

**Goal:** Persist tokens across devices/sessions when not in browser-only mode

**Modify Files:**
- `web/lib/tokenManager.ts` — Add server sync on save/load

**Flow:**
1. On token save: if not browserOnly → POST `/api/tokens` (encrypted)
2. On app load: if localStorage empty → GET `/api/tokens` → decrypt → restore

**Deliverable:** Tokens survive browser cache clears when server mode enabled

---

## Phase 4: UI Components (Week 4)

### 4.1 Dashboard (Combined Storage)

**Goal:** Show aggregate storage from all providers including VPS

**Modify Files:**
- `web/components/Dashboard.tsx`

**Features:**
- Donut chart: total used vs free across all providers
- Per-provider capacity bars including VPS servers
- Warning banner at 80%, alert at 90% on any single provider
- Capacity forecast: "Google Drive full in ~3 weeks at current rate"
- Provider health dots (green/yellow/red) from lightweight HEAD checks
- Stats: total combined, total used, total free, number of providers, files indexed

**Deliverable:** Unified dashboard with VPS included

---

### 4.2 Provider Hub

**Goal:** Manage all connections in one place

**Modify Files:**
- `web/components/RemotesPanel.tsx`

**Features:**
- Connected providers: card per provider with quota bar, health dot, last synced, disconnect
- Unconnected cloud providers: Connect button
- "Add VPS Server" card: distinct server icon, opens connection modal
- Multiple VPS servers supported (user may have several)

**Deliverable:** Central provider management including VPS

---

### 4.3 "Get More Free Storage" Panel

**Goal:** Show unconnected providers with free tiers + affiliate links

**Modify Files:**
- `web/components/StorageUpsell.tsx`

**Features:**
- Cards for unconnected providers with free tier size
- "Sign up free →" button using affiliate links
- "Already have an account? Connect →" button
- Storage calculator: running total of free GB available if all connected
- Only shows providers not yet connected

**Affiliate Links:**
```typescript
const AFFILIATE_LINKS = {
  pcloud:   'https://partner.pcloud.com/?ref=cacheflow',
  filen:    'https://filen.io/?ref=cacheflow',
  internxt: 'https://internxt.com/?ref=cacheflow',
  backblaze: 'https://www.backblaze.com/refer?referredBy=cacheflow',
}
```

**Deliverable:** Upsell panel with affiliate links. Shows "You have up to 52 GB of free storage unclaimed."

---

### 4.4 Search

**Goal:** Search files across all providers simultaneously

**Modify Files:**
- `web/components/SearchBar.tsx`
- `web/lib/providers/all.ts` — Parallel search wrapper

**Features:**
- Single search box, queries all providers in parallel
- Results show provider source icon
- Debounced input (300ms)
- VPS results included (SFTP filename search via API)

**Deliverable:** Cross-provider search including VPS

---

## Phase 5: Server Hot Cache (Week 5)

### 5.1 Metadata Cache API

**Goal:** Server stores metadata for faster access across devices

**New Files:**
- `api/src/routes/cache.js`
- `api/src/services/metadataCache.ts`

**Endpoints:**
| Method | Path | Description |
|---|---|---|
| POST | `/api/cache/metadata` | Cache file listing |
| GET | `/api/cache/metadata/:provider/:folderId` | Get cached listing |
| DELETE | `/api/cache/metadata/:provider` | Invalidate cache |

**Database:**
```sql
CREATE TABLE cached_metadata (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  provider VARCHAR(50),
  folder_id VARCHAR(255),
  files JSONB,
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  UNIQUE(user_id, provider, folder_id)
);
```

**Deliverable:** Server-side metadata caching for cross-device consistency

---

### 5.2 Transfer Progress Proxy

**Goal:** Track transfer progress server-side for cross-device visibility

**New Files:**
- `api/src/routes/transfer.js`

**Endpoints:**
| Method | Path | Description |
|---|---|---|
| POST | `/api/transfer/start` | Register transfer |
| PATCH | `/api/transfer/:id/progress` | Update progress |
| GET | `/api/transfer/:id/status` | Get transfer status |

**Database:**
```sql
CREATE TABLE transfers (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  source_provider VARCHAR(50),
  target_provider VARCHAR(50),
  source_file_id VARCHAR(255),
  target_path VARCHAR(1024),
  status VARCHAR(20), -- pending, transferring, completed, failed
  progress INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

**Deliverable:** Transfer progress visible across devices

---

### 5.3 Provider Health Check

**Goal:** Monitor provider API availability

**New Files:**
- `api/src/routes/health.js`

**Features:**
- Lightweight HEAD request to each provider API
- Green/yellow/red status per provider
- Last successful sync timestamp
- VPS: lightweight SSH connect test (no file operations)

**Deliverable:** Real-time provider status including VPS servers

---

## Phase 6: Advanced Features (Week 6+)

### 6.1 Document Preview 🆕

**Goal:** Open files directly in browser without downloading. Two-tier approach — no new infrastructure for Tier 1.

#### Tier 1 — Pilot (include before launch)

**Google Docs Viewer (read-only, zero infrastructure):**
- Supported formats: `.docx`, `.xlsx`, `.pptx`, `.pdf`
- Implementation: iframe pointing to `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}`
- Requires: generate temporary public download URL from provider, pass to viewer
- Zero new dependencies, works for all providers

**Monaco Editor (full code editing in browser):**
- Supported formats: `.js`, `.ts`, `.tsx`, `.py`, `.json`, `.md`, `.txt`, `.yaml`, `.sh`
- Implementation: `npm install @monaco-editor/react`
- Load file content via provider `downloadFile()`, display in editor, save back via `uploadFile()`
- Already the right choice for Day 64 diff viewer in v4 plan — same dependency

**New Files:**
- `web/components/DocumentViewer.tsx` — Wrapper that picks correct viewer by file type
- `web/components/MonacoEditor.tsx` — Code editor component

**Trigger:** Right-click file → "Open" or double-click. Shows viewer in modal or slide-over panel.

#### Tier 2 — Post-Pilot Month 2 (Collabora Online — full editing)

**What it is:** LibreOffice running in a Docker container, accessible via browser iframe. Full read-write editing of `.docx`, `.xlsx`, `.pptx`. Files never leave your OCI server.

**New Files:**
- `docker-compose.collabora.yml` — Collabora Online container
- `api/src/routes/wopi.js` — WOPI REST protocol implementation

**WOPI Endpoints:**
| Method | Path | Description |
|---|---|---|
| GET | `/api/wopi/files/:id` | File info (name, size, permissions) |
| GET | `/api/wopi/files/:id/contents` | Download file content |
| POST | `/api/wopi/files/:id/contents` | Save edited file back |

**docker-compose addition:**
```yaml
collabora:
  image: collabora/code:latest
  container_name: collabora
  environment:
    - aliasgroup1=https://cacheflow.goels.in
    - DONT_GEN_SSL_CERT=1
  ports:
    - "9980:9980"
  restart: unless-stopped
```

**Estimated effort:** 5–7 days. Not complex — it is a Docker container with a REST API. Deferred only to protect pilot timeline.

**Deliverable Tier 1:** Files open in browser instantly. Code files fully editable and saveable back to any provider.
**Deliverable Tier 2:** Full Office document editing without downloading.

---

### 6.2 Duplicate Detection

**Goal:** Find duplicate files across providers to recover wasted space

**New Files:**
- `web/lib/duplicateFinder.ts`

**Algorithm:**
- Compare: exact filename + size match (fast, no hashing for MVP)
- Group duplicates: "This file exists on Google Drive AND your OCI server"
- One-click delete from secondary location, keep on primary
- Never auto-delete — always require confirmation

**Deliverable:** Duplicate file finder with one-click cleanup

---

### 6.3 Stale File Detection

**Goal:** Flag files wasting space on nearly-full drives

**Logic:**
- File not accessed in 90+ days AND provider >70% full
- Surface in "Cleanup" tab with suggested action: move to emptier provider

**Deliverable:** Stale file cleanup suggestions

---

### 6.4 Auto-Router

**Goal:** Auto-route uploads to provider with most free space

**Rules Engine:**
```typescript
interface RoutingRule {
  condition: 'fileType' | 'fileSize' | 'folder' | 'always'
  value: string
  targetProvider: string | 'auto' // auto = most free space
  priority: number
}
```

**Default rule:** Route to provider with most free space. VPS eligible as auto-route target.

**Deliverable:** Smart upload routing including VPS servers

---

### 6.5 SEO Landing Page

**Goal:** Marketing page targeting "unified cloud storage" keywords

**New Files:**
- `web/app/landing/page.tsx` — Static Next.js page

**Target keywords:**
- "manage multiple cloud storage accounts"
- "combine google drive onedrive free storage"
- "unified cloud storage dashboard"
- "free cloud storage aggregator"
- "connect vps storage to cloud"

**Sections:**
1. Hero: "All your storage. One place." + live storage calculator widget
2. How it works (3 steps: Connect → Browse → Move)
3. Supported providers grid with free tier sizes (include VPS card)
4. Features: auto-routing, duplicate detection, warnings, VPS support
5. "How much free storage do you have?" calculator
6. FAQ (5 questions) with FAQPage JSON-LD schema markup
7. CTA: "Start free, no account needed for first provider"

**Schema markup:** FAQPage + SoftwareApplication JSON-LD

**Deliverable:** Public landing page optimized for organic search

---

## Revised Implementation Order

```
PRE-WEEK 1:
  └── Register Google + Microsoft OAuth apps (do on Day 1, approval takes time)

Week 1: UI Foundation + PWA
  ├── 1.1 Provider Types & Mock Data ← START HERE
  ├── 1.2 Token Manager (Browser)
  ├── 1.3 Server Token Endpoints
  ├── 1.4 Browser-Only Toggle Settings
  ├── 1.5 PWA Manifest + Service Worker ← NEW
  └── 1.6 Dashboard/Browser/Hub UI shells (all with mock data)
      └── Register remaining OAuth apps while UI builds

Week 2a: Core Providers (Google + Microsoft + WebDAV)
  ├── 2.1 Google Drive Adapter (15 GB)
  ├── 2.2 OneDrive Adapter (5 GB)
  └── 2.3 WebDAV Adapter (generic — covers Nextcloud, Yandex WebDAV mode)

Week 2b: Extended Cloud + VPS
  ├── 2.4 Dropbox Adapter (2 GB)
  ├── 2.5 Box Adapter (10 GB)
  └── 2.6 VPS/SFTP Adapter ← NEW (server proxy + browser adapter)

Week 3a: Specialist Providers
  ├── 3.1 pCloud Adapter (10 GB)
  ├── 3.2 Filen Adapter (10 GB, E2E)
  └── 3.3 Yandex Disk Adapter (10 GB)

Week 3b: Integration & Data
  ├── 3.4 Provider Aggregation (unified file browser)
  ├── 3.5 Cross-Provider Copy/Move (including VPS)
  ├── 3.6 Metadata Cache (IndexedDB)
  └── 3.7 Token Sync with Server

Week 4: UI Components
  ├── 4.1 Dashboard (donut chart, forecasting, VPS included)
  ├── 4.2 Provider Hub (cloud + VPS cards)
  ├── 4.3 "Get More Storage" Panel (affiliate links)
  └── 4.4 Search (cross-provider including VPS)

Week 5: Server Hot Cache
  ├── 5.1 Metadata Cache API
  ├── 5.2 Transfer Progress Proxy
  └── 5.3 Provider Health Check (including VPS SSH test)

Week 6+: Advanced Features
  ├── 6.1 Document Preview (Google Docs viewer + Monaco Editor) ← NEW
  ├── 6.2 Duplicate Detection
  ├── 6.3 Stale File Detection
  ├── 6.4 Auto-Router
  └── 6.5 SEO Landing Page

Post-Pilot Month 2:
  └── Collabora Online (full Office editing) ← NEW
```

---

## File Changes Summary

### New Files to Create

```
web/lib/
├── providers/
│   ├── types.ts              # TypeScript interfaces
│   ├── mockProviders.ts      # Mock data for UI development
│   ├── index.ts              # Provider registry
│   ├── StorageProvider.ts    # Abstract base class
│   ├── googleDrive.ts        # Google Drive (15 GB)
│   ├── oneDrive.ts           # OneDrive (5 GB)
│   ├── dropbox.ts            # Dropbox (2 GB)
│   ├── box.ts                # Box (10 GB)
│   ├── pcloud.ts             # pCloud (10 GB)
│   ├── filen.ts              # Filen (10 GB, E2E)
│   ├── yandex.ts             # Yandex Disk (10 GB)
│   ├── webdav.ts             # WebDAV generic
│   └── sftp.ts               # VPS/SFTP (NEW)
├── tokenManager.ts
├── metadataCache.ts
├── fileAggregator.ts
├── transferManager.ts
└── duplicateFinder.ts

web/components/
├── SettingsPanel.tsx
├── ProviderSelector.tsx
├── StorageUpsell.tsx
├── SearchBar.tsx
├── Dashboard.tsx
├── DocumentViewer.tsx        # NEW
└── MonacoEditor.tsx          # NEW

web/public/
├── manifest.json             # NEW — PWA
├── sw.js                     # NEW — Service worker
└── icons/                    # NEW — App icons

api/src/routes/
├── tokens.js
├── cache.js
├── transfer.js
├── health.js
├── sftp.js                   # NEW — SFTP proxy
└── wopi.js                   # NEW — Collabora WOPI (post-pilot)

api/src/services/
└── sftpService.ts            # NEW — SFTP connection pool

migrations/
└── 007_vps_connections.sql   # NEW — VPS credentials table
```

### Files to Modify

```
web/components/
├── RemotesPanel.tsx          # Replace with provider hub (cloud + VPS)
└── FileBrowser.tsx           # Add provider aggregation + duplicate badge

web/lib/
└── api.ts                    # Add new endpoints

next.config.js                # Add next-pwa configuration
docker-compose.yml            # Add collabora service (post-pilot)
```

### Files to Keep (As-Is)

```
api/src/routes/remotes.js     # Keep for existing rclone users
migrations/006_oauth_tokens.sql
worker/                       # Keep for background sync
```

---

## Provider Free Storage Summary

| Provider | Free Storage | Auth Type | Adapter Week | Notes |
|---|---|---|---|---|
| Google Drive | 15 GB | Browser OAuth | Week 2a | Highest priority |
| Box | 10 GB | Browser OAuth | Week 2b | Generous free tier |
| pCloud | 10 GB | Browser OAuth | Week 3a | Affiliate program |
| Filen | 10 GB | Browser OAuth | Week 3a | E2E encrypted |
| Yandex Disk | 10 GB | OAuth/WebDAV | Week 3a | Use WebDAV mode if OAuth blocked |
| OneDrive | 5 GB | Browser OAuth | Week 2a | MSAL.js |
| Dropbox | 2 GB | Browser OAuth | Week 2b | |
| WebDAV (generic) | Varies | Basic/Token | Week 2a | Covers Nextcloud + others |
| **VPS/SFTP** | **50–200 GB** | **SSH Key/Password** | **Week 2b** | **Unique differentiator** |
| **Total** | **~122–272 GB** | | | **Per user, free** |

---

## Success Criteria

- [ ] User can connect Google Drive via browser OAuth popup
- [ ] User can connect OneDrive via browser OAuth popup
- [ ] User can connect Dropbox via browser OAuth popup
- [ ] User can connect any WebDAV server
- [ ] User can connect a VPS/Linux server via SFTP
- [ ] All providers show in unified file browser
- [ ] Cross-provider copy/move works including VPS ↔ cloud
- [ ] VPS disk quota shows in dashboard
- [ ] Tokens persist in localStorage
- [ ] Optional server token storage (encrypted)
- [ ] User can toggle browser-only mode
- [ ] Metadata cached in IndexedDB
- [ ] Transfer progress shown in UI
- [ ] Dashboard shows combined storage including VPS
- [ ] "Get More Storage" panel with affiliate links works
- [ ] App is installable as PWA on mobile and desktop
- [ ] Code files open and edit in Monaco Editor
- [ ] Office files preview via Google Docs viewer

---

## Notes

- All OAuth happens in browser popup — no server redirects lose app state
- Cross-provider transfers are browser-mediated — file content never persists on server disk
- VPS/SFTP is the only exception — requires server proxy due to SSH protocol, but still streams without persistence
- Server hot cache is metadata + progress only
- Default mode stores tokens on server for convenience
- Privacy-focused users can opt-out to browser-only (VPS credentials always server-side)
- PWA service worker caches app shell only — never file content
- Collabora Online deferred to post-pilot to protect May 21 date
- Register OAuth apps during Week 1 — some take days to approve
