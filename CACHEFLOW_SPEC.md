# CacheFlow — Feature Specification
**Version:** 1.0  
**Status:** Implementation Ready  
**Stack:** TypeScript / React (existing codebase)

---

## Overview

CacheFlow is a virtual filesystem aggregator that unifies multiple free cloud storage providers (Google Drive, OneDrive, Dropbox, Box, pCloud, WebDAV, etc.) into a single dashboard. Users connect their existing free-tier accounts to see combined capacity, browse files across all providers, move files between drives, and receive smart warnings before any drive fills up.

**Core principles:**
- No local storage — everything stays in the user's connected cloud providers
- Browser-native OAuth only — no backend auth handling, no rclone, no CLI tools
- Minimal friction — users should be connected in under 2 minutes
- Cache only for performance — file metadata cached in localStorage/IndexedDB, never file content

---

## Phase 1 — Provider Connection & Dashboard

### 1.1 OAuth Connection Flow

Implement browser-native OAuth2 for each provider. All auth happens via popup windows — no redirects that lose app state.

**Providers to implement (in priority order):**

| Provider | Free Storage | SDK / Auth Method | Notes |
|---|---|---|---|
| Google Drive | 15 GB | Google Identity Services (`https://accounts.google.com/gsi/client`) | Pure JS, no backend needed |
| OneDrive | 5 GB | MSAL.js (`@azure/msal-browser`) | Pure JS, no backend needed |
| Dropbox | 2 GB | Dropbox JS SDK (`dropbox`) | PKCE OAuth2 |
| Box | 10 GB | Box JS SDK (`box-ui-elements`) | OAuth2 popup |
| pCloud | 10 GB | REST API + OAuth2 | Manual PKCE implementation |
| Filen | 10 GB | `@filen/sdk` | E2E encrypted, TS SDK available |
| Yandex Disk | 10 GB | WebDAV + OAuth2 | Treat as WebDAV after auth |
| WebDAV (generic) | varies | Basic auth / token | Requires OCI proxy for CORS — see 1.3 |

**Connection UI requirements:**
- Each provider shown as a card: logo, name, free tier size, "Connect" button
- On connect: open OAuth popup → on success → show connected state with quota bar
- Connected state shows: used / total / percentage, last synced timestamp
- Disconnecting clears tokens and cached metadata for that provider only
- Store tokens in `localStorage` keyed by provider ID — never send to server

**OAuth token storage structure:**
```typescript
interface ProviderToken {
  provider: 'google' | 'onedrive' | 'dropbox' | 'box' | 'pcloud' | 'filen' | 'webdav';
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // unix timestamp
  accountEmail: string;
  displayName: string;
}
// localStorage key: `cacheflow_token_${provider}`
```

### 1.2 Combined Storage Dashboard

**Main dashboard view:**

- **Total capacity bar** — aggregate used vs total across all connected providers, single horizontal bar
- **Per-provider breakdown** — list of connected providers with individual capacity bars
- **Warning system:**
  - Yellow warning at 80% full on any single provider
  - Red alert at 90% full
  - Banner at top of dashboard when any provider is in warning state
- **Capacity forecast** — based on last 30 days upload rate, show "X drive will be full in ~N weeks"
- **Combined storage calculator** — show how much free space user has unused across all providers

**Dashboard stats cards:**
- Total combined storage
- Total used
- Total free remaining
- Number of connected providers
- Number of files indexed

### 1.3 WebDAV Proxy (OCI Server)

WebDAV servers block browser requests due to CORS. Implement a lightweight proxy on the OCI server.

**Requirements:**
- Single Express.js endpoint: `POST /api/webdav-proxy`
- Accepts: `{ url, method, headers, body }` from browser
- Forwards request to WebDAV server, returns response
- Never logs request body or auth headers
- Rate limit: 100 req/min per IP
- Deploy as part of existing Docker Compose setup

---

## Phase 2 — File Browser

### 2.1 Unified File Browser

Single file browser that shows files from all connected providers in one view.

**Views:**
- **All Files** — merged view across all providers, sorted by modified date
- **Per Provider** — filter to single provider
- **Folder navigation** — breadcrumb path, click to navigate into folders

**File listing columns:**
- Provider icon (small, color-coded per provider)
- File name
- Size
- Modified date
- Provider name
- Actions menu (copy, move, download link, delete)

**Search:**
- Search box queries all connected providers simultaneously
- Results show provider source next to each file
- Search by filename only (no content search — provider APIs don't expose it uniformly)

### 2.2 File Operations

**Copy to another drive:**
- User right-clicks file → "Copy to..." → picks target provider
- Download file from source provider API → upload to target provider API
- Show progress indicator during transfer
- Never write file to OCI server — stream directly browser → source → target where possible
- For large files (>100MB): warn user, confirm before proceeding

**Move between drives:**
- Same as copy but deletes source file after successful upload
- Confirm dialog before delete
- If upload fails, do NOT delete source

**Copy sharable link:**
- Generate public share link via provider API where supported
- Copy to clipboard with one click
- Show which providers support public links (Google Drive ✅, OneDrive ✅, Dropbox ✅, WebDAV ❌)

### 2.3 Metadata Cache

Cache file listings in IndexedDB to avoid re-fetching on every page load.

```typescript
interface CachedListing {
  provider: string;
  folderId: string;
  files: FileMetadata[];
  cachedAt: number; // unix timestamp
  ttl: number; // milliseconds, default 5 minutes
}
```

- Cache TTL: 5 minutes for active providers, 30 minutes for inactive
- Manual refresh button per provider
- Auto-refresh when user navigates to a folder

---

## Phase 3 — Smart Features

### 3.1 Auto-Router

When user saves/uploads a file through CacheFlow, automatically route it to the provider with the most free space.

**Rules engine (user configurable):**
```typescript
interface RoutingRule {
  condition: 'fileType' | 'fileSize' | 'folder' | 'always';
  value: string; // e.g. 'image/*', '>100MB', '/Photos'
  targetProvider: string; // provider ID or 'auto' (most free space)
  priority: number;
}
```

- Default rule: route to provider with most free space
- User can add custom rules in Settings
- Rules evaluated in priority order, first match wins

### 3.2 Duplicate Detection

Find duplicate files across providers to recover wasted space.

**Algorithm:**
- Compare files by: exact filename + size match (fast, no hashing needed for MVP)
- Show duplicates grouped: "This file exists on Google Drive AND OneDrive"
- One-click delete from secondary location, keep on primary
- Never auto-delete — always require user confirmation

### 3.3 Stale File Detection

Flag files that waste space on nearly-full drives.

**Logic:**
- File not accessed in 90+ days AND provider is >70% full → flag as stale
- Surface in "Cleanup" tab with suggested action: move to emptier provider or delete
- Batch select + move in one operation

### 3.4 Provider Health Monitor

Show real-time status of each provider's API.

- Check API availability on dashboard load (lightweight HEAD request)
- Green / Yellow / Red status dot next to each provider
- If provider is degraded: auto-suggest using alternative provider for new uploads
- Show last successful sync timestamp

---

## Phase 4 — Growth Features

### 4.1 "Get More Free Storage" Panel

Show users additional providers they haven't connected yet, with free tier sizes.

**UI:**
- Section in dashboard: "Unlock more free storage"
- Cards for unconnected providers showing free tier size
- "Sign up free" button — opens provider signup page via affiliate link where available
- "Already have an account? Connect →" button

**Affiliate link tracking:**
```typescript
const AFFILIATE_LINKS = {
  pcloud: 'https://partner.pcloud.com/?ref=CACHEFLOW',
  filen: 'https://filen.io/?ref=cacheflow',
  internxt: 'https://internxt.com/?ref=cacheflow',
  // add others as programs are approved
};
```

**Storage calculator widget (also for SEO landing page):**
- Checkboxes for each provider user already has
- Shows running total of free storage they could have
- CTA: "Manage it all in one place with CacheFlow"

### 4.2 Usage Analytics (Privacy-First)

Local-only analytics — nothing sent to server.

Track in localStorage:
- Files transferred between providers (count + total size)
- Space recovered from duplicate/stale cleanup
- Most used provider
- Storage saved vs paying for equivalent space (show "You've saved $X vs Google One")

Show as a "Your CacheFlow stats" card on dashboard.

---

## Technical Architecture

### State Management
```typescript
// Global store structure
interface CacheFlowStore {
  providers: {
    [providerId: string]: {
      token: ProviderToken;
      quota: { used: number; total: number };
      status: 'connected' | 'error' | 'refreshing';
      lastSynced: number;
    }
  };
  files: CachedListing[];
  routingRules: RoutingRule[];
  settings: UserSettings;
}
```

### Provider Abstraction Layer

All providers must implement this interface — no provider-specific code outside the adapter:

```typescript
interface StorageProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  freeStorageGB: number;
  
  // Auth
  connect(): Promise<ProviderToken>;
  disconnect(): Promise<void>;
  refreshToken(token: ProviderToken): Promise<ProviderToken>;
  
  // Quota
  getQuota(): Promise<{ used: number; total: number }>;
  
  // Files
  listFiles(folderId?: string): Promise<FileMetadata[]>;
  searchFiles(query: string): Promise<FileMetadata[]>;
  uploadFile(file: File, folderId?: string, onProgress?: (pct: number) => void): Promise<FileMetadata>;
  downloadFile(fileId: string): Promise<Blob>;
  deleteFile(fileId: string): Promise<void>;
  getShareLink(fileId: string): Promise<string | null>;
}
```

### Environment Variables Required
```bash
# Google Drive
REACT_APP_GOOGLE_CLIENT_ID=

# Microsoft OneDrive  
REACT_APP_MSAL_CLIENT_ID=
REACT_APP_MSAL_TENANT_ID=common

# Dropbox
REACT_APP_DROPBOX_APP_KEY=

# Box
REACT_APP_BOX_CLIENT_ID=

# pCloud
REACT_APP_PCLOUD_CLIENT_ID=

# WebDAV proxy (OCI server URL)
REACT_APP_WEBDAV_PROXY_URL=https://your-oci-server/api/webdav-proxy
```

---

## Implementation Order

```
Phase 1a — Google Drive + OneDrive connection + combined dashboard  [Week 1-2]
Phase 1b — Dropbox + Box + WebDAV connection                       [Week 2-3]
Phase 2a — Unified file browser with search                        [Week 3-4]
Phase 2b — Copy/move between providers                             [Week 4]
Phase 3a — Duplicate detection + stale file cleanup                [Week 5]
Phase 3b — Auto-router + routing rules                             [Week 5-6]
Phase 4a — "Get more storage" panel + affiliate links              [Week 6]
Phase 4b — Storage calculator + SEO landing page                   [Week 7]
```

---

## SEO Landing Page

Build as separate static HTML at `/landing/index.html` (same pattern as Mathkit landing page).

**Target keywords:**
- "manage multiple cloud storage accounts"
- "combine google drive onedrive free storage"
- "unified cloud storage dashboard"
- "free cloud storage aggregator"

**Page sections:**
1. Hero — "All your free cloud storage. One place." + storage calculator widget
2. How it works — 3 steps: Connect → Browse → Move
3. Supported providers grid with free tier sizes
4. Features — auto-routing, duplicate detection, warnings
5. "Get more free storage" — list of providers with free tiers and total available
6. FAQ — 5 questions with FAQPage JSON-LD schema markup
7. CTA — "Start for free, no account needed"

**Schema markup:** FAQPage + SoftwareApplication JSON-LD
