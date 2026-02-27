# Code Review - Provider Changes

## Security Fixes

### 1. box.ts - Removed client_secret from PKCE flow

**Before:**
```typescript
const response = await fetch('https://api.box.com/oauth2/token', {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: BOX_CLIENT_ID,
    client_secret: process.env.NEXT_PUBLIC_BOX_CLIENT_SECRET || '', // BAD: Exposed in browser
    code_verifier: codeVerifier || '',
  }),
})
```

**After:**
```typescript
// PKCE flow - no client_secret needed
const response = await fetch('https://api.box.com/oauth2/token', {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: BOX_CLIENT_ID,
    code_verifier: codeVerifier || '',
  }),
})
```

**Also Fixed:**
- `space.alloted` → `space.allocated` (API field name)
- Added `retried` parameter to `makeRequest()` to prevent infinite 401 loops
- Quota fallback chain: `space.allocated ?? space.space_amount ?? 0`

---

### 2. filen.ts - Token moved to Authorization header

**Before:**
```typescript
private async req(ep: string, body?: any): Promise<any> {
  const u = new URL(FILEN_API_BASE+ep)
  if (this.accessToken) u.searchParams.set('auth', this.accessToken) // BAD: Token in URL
  const res = await fetch(u.toString(), { ... })
}
```

**After:**
```typescript
private async req(ep: string, body?: any, retried = false, method = 'POST'): Promise<any> {
  const res = await fetch(FILEN_API_BASE+ep, {
    method,
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.accessToken}` // SECURE: Token in header
    },
    body: method !== 'GET' && body ? JSON.stringify(body) : undefined
  })
  // Added retried param to prevent infinite loops
  if (res.status === 401 && !retried) {
    const nt = await tokenManager.refreshToken('filen')
    if (nt) {
      this.accessToken = nt.accessToken
      return this.req(ep, body, true, method)
    }
    throw new Error('SESSION_EXPIRED')
  }
}
```

**Also Fixed:**
- `uploadFile` and `downloadFile` now use Authorization header
- `gm()` mime type helper → imported `formatMimeType()` from utils
- `fb()` formatBytes helper → imported from utils

---

### 3. pcloud.ts - Token moved to Authorization header

**Before:**
```typescript
const u = new URL(PCLOUD_API_BASE+ep)
if (this.accessToken) u.searchParams.set('access_token', this.accessToken) // BAD
```

**After:**
```typescript
const res = await fetch(PCLOUD_API_BASE+ep, {
  headers: { Authorization: `Bearer ${this.accessToken}` } // SECURE
})
```

---

### 4. dropbox.ts, oneDrive.ts, googleDrive.ts

All received:
- Added `retried` parameter to prevent infinite 401 loops
- Import shared utilities from `pkce.ts` and `utils.ts`
- Added SESSION_EXPIRED error on 401 refresh failure

---

### 5. googleDrive.ts - Additional fixes

**Fixed Google Docs export:**
```typescript
// Before: Checked for any googleapps string
if (metadata.mimeType.includes('googleapps')) {

// After: Explicit allowlist
const googleDocsTypes = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  // ...
]
if (googleDocsTypes.includes(metadata.mimeType)) {
```

**Non-exportable types:**
```typescript
const NON_EXPORTABLE = ['application/vnd.google-apps.script']
if (NON_EXPORTABLE.includes(metadata.mimeType)) {
  throw new Error('This file type cannot be downloaded.')
}
```

**Fixed moveFile:**
```typescript
// Before: Used cached file data
const file = await this.getFile(fileId)
const previousParents = (file as any).parents || []

// After: Direct API call
const fileResponse = await fetch(
  `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`,
  { headers: { Authorization: `Bearer ${this.accessToken}` } }
)
const fileData = await fileResponse.json()
const previousParents = fileData.parents || []
```

**Icon fix:**
```typescript
getIcon(): string { return '🗂️' }  // Was: 📁
```

---

### 6. oneDrive.ts - Download URL Fix

**Before:**
```typescript
const downloadUrl = (file as any).downloadUrl
```

**After:**
```typescript
const downloadUrl = (file as any)['@microsoft.graph.downloadUrl']
```

---

## New Shared Modules

### pkce.ts
```typescript
export function generateCodeVerifier(): string { ... }
export async function generateCodeChallenge(verifier: string): Promise<string> { ... }
export function base64UrlEncode(array: Uint8Array): string {
  return btoa(Array.from(array, b => String.fromCharCode(b)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
```

### utils.ts
```typescript
export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id))
}

export function formatBytes(bytes: number): string { ... }
export function formatMimeType(filename: string): string { ... }
```

**Key fix in formatMimeType:**
```typescript
png: 'image/png',  // Was: 'image/gif' (BUG!)
gif: 'image/gif',
```

---

## Files Changed

| File | Changes |
|------|---------|
| `box.ts` | Removed client_secret, quota field, retried param, quota fallback chain |
| `filen.ts` | Token in header, retried param, formatMimeType, method param, SESSION_EXPIRED |
| `pcloud.ts` | Token in header, retried param, formatMimeType |
| `dropbox.ts` | retried param, formatMimeType, SESSION_EXPIRED |
| `oneDrive.ts` | retried param, formatMimeType, downloadUrl fix, SESSION_EXPIRED |
| `googleDrive.ts` | retried param, Google Docs export, moveFile, script exclusion, icon 🗂️, SESSION_EXPIRED |
| `types.ts` | Fixed Google Drive icon 📧 → 🗂️ |
| `vps.ts` | Fixed renameFile path |
| `webdav.ts` | Fixed Depth header, formatMimeType |
| `yandex.ts` | Fixed hasMore field, formatMimeType |
| `pkce.ts` | NEW - Shared PKCE helpers, fixed base64UrlEncode |
| `utils.ts` | NEW - formatBytes, formatMimeType, fetchWithTimeout |

---

## Security Gap Note
OAuth tokens are currently stored in localStorage (XSS risk). Server-side token storage was disabled. Re-enable before production.

```typescript
// TODO: SECURITY — OAuth tokens currently stored in localStorage (XSS risk).
// Server-side token storage was disabled. Re-enable before production.
// See: /api/tokens endpoint
```
