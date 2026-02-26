# CacheFlow Roadmap — Client-Side OAuth Architecture

**Version:** 2.0 (Revised)
**Status:** Implementation Ready
**Generated:** 2026-02-26
**Architecture:** Hybrid OAuth (Browser + Optional Server Storage)

---

## Architecture Overview

### Hybrid Token Storage

| Mode | Token Storage | Use Case |
|------|--------------|----------|
| **Default** | Browser localStorage (primary) + Server encrypted (backup) | Convenience, faster re-login |
| **Privacy** | Browser localStorage only | Privacy-focused users |

- Server tokens are **encrypted** with AES-256 before storage
- User can toggle "Browser-only mode" in settings
- Background sync uses server tokens (if mode = default)

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
│  │   Dropbox)  │     │  - Cache TTL │     │   - Never touches     │  │
│  │              │     │              │     │     server disk       │  │
│  └──────────────┘     └──────────────┘     └───────────────────────┘  │
│         ▲                     ▲                          ▲               │
│         │                     │                          │               │
│  ┌──────┴─────────────────────┴──────────────────────────┴──────────┐ │
│  │                    TOKEN MANAGER                                 │ │
│  │  - localStorage: access_token, refresh_token, expires_at        │ │
│  │  - Server sync (optional): encrypted tokens via API              │ │
│  │  - browserOnly mode toggle                                       │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              SERVER                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌───────────────────────┐  │
│  │   Metadata   │     │    Token     │     │   Transfer Relay     │  │
│  │    Cache     │     │   Storage   │     │   (Optional buffer)  │  │
│  │  - File list │     │ (Encrypted) │     │   - Temp upload      │  │
│  │  - Quota     │     │ - Optional  │     │   - Progress only    │  │
│  │  - Provider  │     │ - Per-user   │     │   - No persistence  │  │
│  │    health    │     │ - Opt-in     │     │                       │  │
│  └──────────────┘     └──────────────┘     └───────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: UI Foundation (Week 1)

### 1.1 Provider Types & Mock Data

**Goal:** Define types and create mock providers for UI development

**New Files:**
- `web/lib/providers/types.ts` — TypeScript interfaces
- `web/lib/providers/mockProviders.ts` — Mock implementations for testing UI

**Why first:**
- UI developers can work in parallel with backend
- Test all flows before real providers exist

**Deliverable:** Type definitions + mock providers for all 8 providers

**New Files:**
- `web/lib/providers/index.ts` — Base types and interfaces
- `web/lib/providers/types.ts` — ProviderToken, FileMetadata, etc.
- `web/lib/providers/StorageProvider.ts` — Abstract base class

**Interface:**
```typescript
interface StorageProvider {
  id: string
  name: string
  icon: string
  color: string
  freeStorageGB: number

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

**Deliverable:** All future provider implementations follow this interface

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
  browserOnlyMode: boolean  // default: false (server storage enabled)
  autoRefreshTokens: boolean // default: true
  cacheTTLMinutes: number    // default: 5
}
```

**Deliverable:** User can toggle browser-only mode

---

## Phase 2: Provider Implementations (Week 2)

### 2.1 Google Drive Adapter

**Goal:** Full Google Drive integration using client-side OAuth

**New Files:**
- `web/lib/providers/googleDrive.ts` — Google Drive implementation

**Dependencies:**
- `@googleapis/drive` — Official Google Node.js SDK (works in browser)
- Google Identity Services for OAuth: `https://accounts.google.com/gsi/client`

**Flow:**
1. User clicks "Connect Google Drive"
2. Popup opens with Google OAuth (GIS token model)
3. On success: tokens stored in localStorage via TokenManager
4. Optionally sync to server (if not browser-only mode)

**Scopes:**
```
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/drive.metadata.readonly
```

**Deliverable:** Google Drive connect/disconnect, file listing, quota

---

### 2.2 OneDrive Adapter

**Goal:** Full OneDrive integration using client-side OAuth

**New Files:**
- `web/lib/providers/oneDrive.ts` — OneDrive implementation

**Dependencies:**
- `@azure/msal-browser` — Microsoft Authentication Library

**Flow:**
1. User clicks "Connect OneDrive"
2. Popup opens with MSAL.js
3. On success: tokens stored in localStorage via TokenManager

**Scopes:**
```
Files.Read.All
offline_access
```

**Deliverable:** OneDrive connect/disconnect, file listing, quota

---

### 2.3 Dropbox Adapter

**Goal:** Full Dropbox integration using client-side OAuth

**New Files:**
- `web/lib/providers/dropbox.ts` — Dropbox implementation

**Dependencies:**
- `dropbox` — Official Dropbox JavaScript SDK

**Flow:**
1. User clicks "Connect Dropbox"
2. Redirect to Dropbox OAuth (PKCE)
3. On success: tokens stored in localStorage

**Scopes:**
```
files.content.read
account_info.read
```

**Deliverable:** Dropbox connect/disconnect, file listing, quota

---

### 2.4 Box Adapter

**Goal:** Box.com cloud storage integration

**New Files:**
- `web/lib/providers/box.ts` — Box implementation

**Dependencies:**
- `@box/box-node-sdk` or manual OAuth PKCE

**Scopes:**
```
root_readonly
```

**Deliverable:** Box connect/disconnect, file listing, quota

---

### 2.5 pCloud Adapter

**Goal:** pCloud cloud storage (10 GB free tier)

**New Files:**
- `web/lib/providers/pcloud.ts` — pCloud implementation

**Auth:**
- OAuth2 with manual PKCE implementation
- Requires custom OAuth flow (pCloud doesn't have JS SDK)

**Scopes:**
```
pcloud.readonly
pcloud.write
```

**Deliverable:** pCloud connect/disconnect, file listing, quota

---

### 2.6 Filen Adapter

**Goal:** Filen.io cloud storage (E2E encrypted)

**New Files:**
- `web/lib/providers/filen.ts` — Filen implementation

**Dependencies:**
- `@filen/sdk` — Official Filen SDK with TypeScript support

**Note:**
- Filen is E2E encrypted — tokens stay client-side
- All file operations happen via their SDK

**Deliverable:** Filen connect/disconnect, file listing, quota

---

### 2.7 Yandex Disk Adapter

**Goal:** Yandex Disk cloud storage (10 GB free)

**New Files:**
- `web/lib/providers/yandex.ts` — Yandex Disk implementation

**Auth:**
- OAuth2
- Can also treat as WebDAV after auth

**Scopes:**
```
cloud_api:disk.read
cloud_api:disk.write
```

**Deliverable:** Yandex connect/disconnect, file listing, quota

---

### 2.8 WebDAV Adapter (Generic)

**Goal:** Support generic WebDAV servers (Nextcloud, ownCloud, etc.)

**New Files:**
- `web/lib/providers/webdav.ts` — WebDAV implementation

**Dependencies:**
- `webdav` — WebDAV client library

**Auth:**
- Basic auth (username/password)
- Bearer token (for Nextcloud)
- OAuth token (for some providers)

**Deliverable:** Connect to any WebDAV server with credentials

---

## Phase 3: Unified File Browser (Week 3)

### 3.1 Provider Aggregation

**Goal:** Merge file listings from all providers into single view

**Modify Files:**
- `web/components/FileBrowser.tsx` — Add provider aggregation
- `web/lib/fileAggregator.ts` — NEW: Merge files from all providers

**Features:**
- Unified file list sorted by date
- Provider indicator (color dot + icon)
- Filter by provider
- Virtual scrolling for large lists

**Deliverable:** Single view showing files from all connected providers

---

### 3.2 Provider Selector

**Goal:** Let users choose which provider for operations

**Modify Files:**
- `web/components/ProviderSelector.tsx` — NEW component
- `web/components/RemotesPanel.tsx` — Integrate provider selector

**Features:**
- Dropdown to select target provider for upload
- Show available free space per provider
- Auto-select: provider with most free space (default)

**Deliverable:** Users can choose target provider for any operation

---

### 3.3 Cross-Provider Copy/Move

**Goal:** Copy and move files between different providers

**Modify Files:**
- `web/lib/transferManager.ts` — NEW: Cross-provider transfers

**Flow:**
1. User selects file → clicks "Copy to..."
2. Browser-mediated: Download from source provider → upload to target
3. Progress bar in UI
4. On success: notify user, update file list
5. On failure: show error, source file unchanged

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

**Deliverable:** Copy/move files between any two providers

---

### 3.4 Metadata Cache (IndexedDB)

**Goal:** Cache file listings to avoid re-fetching

**New Files:**
- `web/lib/metadataCache.ts` — IndexedDB wrapper

**Cache Strategy:**
- TTL: 5 minutes for active, 30 minutes for inactive
- Manual refresh button per provider
- Auto-refresh on folder navigation

**Deliverable:** Fast file browser, reduced API calls

---

## Phase 4: UI Components (Week 4)

### 4.1 Dashboard (Combined Storage)

**Goal:** Show aggregate storage from all providers

**Modify Files:**
- `web/components/Dashboard.tsx` — Combined storage view

**Features:**
- Total capacity bar (used/total)
- Per-provider breakdown with capacity bars
- Warning at 80%, alert at 90%
- Provider health indicators (green/yellow/red)

**Deliverable:** Unified dashboard showing all storage

---

### 4.2 Provider Hub

**Goal:** Manage all cloud connections in one place

**Modify Files:**
- `web/components/RemotesPanel.tsx` — Provider management UI

**Features:**
- Grid of provider cards (connected/unconnected)
- Connect/disconnect buttons
- Usage per provider
- Add custom WebDAV server

**Deliverable:** Central provider management

---

### 4.3 "Get More Storage" Panel

**Goal:** Show unconnected providers with free tiers

**Modify Files:**
- `web/components/StorageUpsell.tsx` — NEW component

**Features:**
- List unconnected providers with free tier sizes
- Affiliate links where available
- "Connect" button per provider
- Storage calculator widget

**Affiliate Links:**
```typescript
const AFFILIATE_LINKS = {
  pcloud: 'https://partner.pcloud.com/?ref=cacheflow',
  filen: 'https://filen.io/?ref=cacheflow',
  internxt: 'https://internxt.com/?ref=cacheflow',
}
```

**Deliverable:** Upsell panel with affiliate integration

---

### 4.4 Search

**Goal:** Search files across all providers

**Modify Files:**
- `web/components/SearchBar.tsx` — Unified search
- `web/lib/providers/all.ts` — Parallel search wrapper

**Features:**
- Search box queries all providers simultaneously
- Results show provider source
- Debounced input (300ms)

**Deliverable:** Cross-provider search

---

## Phase 5: Server Hot Cache (Week 5)

### 5.1 Metadata Cache API

**Goal:** Server stores metadata for faster access

**New/Modify Files:**
- `api/src/routes/cache.js` — NEW: Metadata cache endpoints
- `api/src/services/metadataCache.ts` — NEW: Cache service

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/cache/metadata` | Cache file listing |
| GET | `/api/cache/metadata/:provider/:folderId` | Get cached listing |
| DELETE | `/api/cache/metadata/:provider` | Invalidate cache |

**Database:**
- New table: `cached_metadata`
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

**Deliverable:** Server-side metadata caching

---

### 5.2 Transfer Progress Proxy

**Goal:** Track transfer progress without server-side file storage

**New/Modify Files:**
- `api/src/routes/transfer.js` — NEW: Transfer status endpoints

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transfer/start` | Register transfer (browser-mediated) |
| PATCH | `/api/transfer/:id/progress` | Update progress |
| GET | `/api/transfer/:id/status` | Get transfer status |

**Database:**
- New table: `transfers`
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

**Deliverable:** Transfer progress tracking

---

### 5.3 Provider Health Check

**Goal:** Monitor provider API availability

**New/Modify Files:**
- `api/src/routes/health.js` — NEW: Health check endpoints

**Features:**
- Lightweight HEAD request to each provider
- Green/yellow/red status per provider
- Last successful sync timestamp

**Deliverable:** Real-time provider status

---

## Phase 6: Advanced Features (Week 6+)

### 6.1 Duplicate Detection

**Goal:** Find duplicate files across providers

**Algorithm:**
- Compare: filename + size (fast, no hashing)
- Show grouped duplicates
- One-click delete from secondary

**New Files:**
- `web/lib/duplicateFinder.ts` — NEW

**Deliverable:** Duplicate file finder

---

### 6.2 Stale File Detection

**Goal:** Flag files wasting space on nearly-full drives

**Logic:**
- File not accessed in 90+ days AND provider >70% full
- Surface in "Cleanup" tab

**Deliverable:** Stale file cleanup suggestions

---

### 6.3 Auto-Router

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

**Deliverable:** Smart upload routing

---

### 6.4 SEO Landing Page

**Goal:** Marketing page for new users

**New Files:**
- `web/app/landing/page.tsx` — Static marketing page

**Sections:**
1. Hero + storage calculator
2. How it works (3 steps)
3. Supported providers
4. Features
5. FAQ with JSON-LD schema
6. CTA

**Deliverable:** Public landing page

---

## Implementation Order

```
Week 1: UI Foundation (START HERE)
  ├── 1.1 Provider Types & Mock Data ← START
  ├── 1.2 Dashboard UI
  ├── 1.3 Provider Hub UI
  ├── 1.4 Unified File Browser UI
  ├── 1.5 Upload Component UI
  ├── 1.6 Context Menu UI (Copy/Move)
  ├── 1.7 Search UI
  └── 1.8 Settings Panel UI

Week 2: Provider Adapters
  ├── 2.1 Provider Adapter Interface
  ├── 2.2 Token Manager (Browser)
  ├── 2.3 Server Token Endpoints
  ├── 2.4 Google Drive Adapter (15 GB)
  ├── 2.5 OneDrive Adapter (5 GB)
  ├── 2.6 Dropbox Adapter (2 GB)
  ├── 2.7 Box Adapter (10 GB)
  ├── 2.8 pCloud Adapter (10 GB)
  ├── 2.9 Filen Adapter (10 GB, E2E encrypted)
  ├── 2.10 Yandex Disk Adapter (10 GB)
  └── 2.11 WebDAV Adapter (Generic)

Week 3: Integration & Data
  ├── 3.1 Connect Providers to UI
  ├── 3.2 Metadata Cache (IndexedDB)
  ├── 3.3 Cross-Provider Copy/Move
  └── 3.4 Token Sync with Server

Week 4: Server Hot Cache
  ├── 4.1 Metadata Cache API
  ├── 4.2 Transfer Progress Proxy
  └── 4.3 Provider Health Check

Week 5+: Advanced Features
  ├── Duplicate Detection
  ├── Stale File Detection
  ├── Auto-Router
  └── SEO Landing Page
```
  ├── 4.3 Get More Storage Panel
  └── 4.4 Search

Week 5: Server Hot Cache
  ├── 5.1 Metadata Cache API
  ├── 5.2 Transfer Progress Proxy
  └── 5.3 Provider Health Check

Week 6+: Advanced Features
  ├── 6.1 Duplicate Detection
  ├── 6.2 Stale File Detection
  ├── 6.3 Auto-Router
  └── 6.4 SEO Landing Page
```

---

## File Changes Summary

### New Files to Create

```
web/lib/
├── providers/
│   ├── types.ts              # TypeScript interfaces (START HERE)
│   ├── mockProviders.ts      # Mock data for UI development
│   ├── index.ts              # Provider registry
│   ├── StorageProvider.ts    # Abstract base class
│   ├── googleDrive.ts        # Google Drive (15 GB free)
│   ├── oneDrive.ts           # OneDrive (5 GB free)
│   ├── dropbox.ts            # Dropbox (2 GB free)
│   ├── box.ts                # Box (10 GB free)
│   ├── pcloud.ts             # pCloud (10 GB free)
│   ├── filen.ts              # Filen (10 GB free, E2E encrypted)
│   ├── yandex.ts             # Yandex Disk (10 GB free)
│   └── webdav.ts             # WebDAV (generic, varies)
├── tokenManager.ts           # Token storage/refresh
├── metadataCache.ts          # IndexedDB wrapper
├── fileAggregator.ts         # Merge provider files
├── transferManager.ts        # Cross-provider transfers
└── duplicateFinder.ts        # Duplicate detection

web/components/
├── SettingsPanel.tsx         # User settings
├── ProviderSelector.tsx      # Target provider picker
├── StorageUpsell.tsx        # Get more storage
├── SearchBar.tsx            # Unified search
└── Dashboard.tsx            # Combined storage

api/src/routes/
├── tokens.js                # Token CRUD
├── cache.js                 # Metadata cache
├── transfer.js              # Transfer progress
└── health.js                # Provider health
```

### Files to Modify

```
web/components/
├── RemotesPanel.tsx         # Replace with new provider hub
└── FileBrowser.tsx          # Add provider aggregation

web/lib/
└── api.ts                  # Add new endpoints
```

### Files to Delete

```
Nothing deleted - backward compatible
```

### Files to Keep (As-Is)

```
api/src/routes/remotes.js    # Keep for existing rclone users
migrations/006_oauth_tokens.sql  # Keep for optional server storage
worker/                     # Keep for background sync (optional)
```

---

## Success Criteria

- [ ] User can connect Google Drive via browser OAuth
- [ ] User can connect OneDrive via browser OAuth
- [ ] User can connect Dropbox via browser OAuth
- [ ] User can connect WebDAV server
- [ ] All providers show in unified file browser
- [ ] Cross-provider copy/move works in browser
- [ ] Tokens persist in localStorage
- [ ] Optional server token storage (encrypted)
- [ ] User can toggle browser-only mode
- [ ] Metadata cached in IndexedDB
- [ ] Transfer progress shown in UI
- [ ] Dashboard shows combined storage
- [ ] "Get More Storage" panel works

---

## Notes

- All OAuth happens in browser popup — no server redirects lose app state
- Cross-provider transfers are browser-mediated — file content never persists on server
- Server hot cache is metadata + progress only
- Default mode stores tokens on server for convenience
- Privacy-focused users can opt-out to browser-only
