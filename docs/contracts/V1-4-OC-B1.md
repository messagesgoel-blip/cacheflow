# V1-4-OC-B1: SEC-01 and APP-10 Verification

## Summary

Batch 1 verification for the CacheFlow V1-4 live E2E triage hold.

**Result**: All scoped items were already implemented for this verification pass. SEC-01 is closed here as a browser-visible storage cleanup, not as a full migration of provider secrets out of browser runtime memory.

## Scope

- SEC-01: Remove browser-visible auth state
- APP-10: Reduce 401 noise from background/prefetch requests
- APP-01: Verify-only check for upload invalidation
- APP-09: Verify-only check for /api/health endpoint

## Files Reviewed

| File | Purpose | Status |
|------|---------|--------|
| `web/lib/auth/clientSession.ts` | Client-side session management | No changes needed |
| `web/lib/auth/cookieAuth.ts` | Cookie-based auth migration | No changes needed |
| `web/lib/auth/serverSession.ts` | Server-side session resolution | No changes needed |
| `web/lib/interceptors/authInterceptor.ts` | Auth request interception | No changes needed |
| `web/lib/apiClient.ts` | Centralized API client | No changes needed |
| `web/lib/api.ts` | API helper functions | No changes needed |
| `web/lib/tokenManager.ts` | Provider token management | No changes needed |
| `web/components/HomeEntry.tsx` | Login entry point | No changes needed |
| `web/components/Login.tsx` | Login form component | No changes needed |
| `web/components/SessionExpiredBannerHost.tsx` | Session expiry handling | No changes needed |
| `web/components/UnifiedFileBrowser.tsx` | File browser with upload | No changes needed |
| `web/app/api/health/route.ts` | Health endpoint | No changes needed |
| `web/app/api/auth/session/route.ts` | Session endpoint | No changes needed |
| `web/app/api/connections/route.ts` | Connections API | No changes needed |
| `web/app/files/page.tsx` | Files page | No changes needed |
| `web/app/layout.tsx` | Root layout | No changes needed |
| `web/lib/providers/vps.ts` | VPS provider adapter | No changes needed |

## SEC-01: Browser-Visible Auth State

**Status**: Browser-visible storage fixed (CAC-64); browser runtime-memory caveat remains outside this verification batch

### Verification Findings

1. **cf_token/cf_email**: Only appear in `removeItem` calls for cleanup/migration:
   - `web/lib/auth/clientSession.ts:30-31` - `clearLegacyAuthState()` removes them
   - `web/lib/auth/cookieAuth.ts:151-152` - `migrateFromLocalStorage()` removes them
   - `web/e2e/helpers/mockRuntime.ts:186-187` - Test cleanup

2. **Auth flow**: Uses HttpOnly cookies via:
   - `web/lib/auth/cookieAuth.ts` - Cookie management
   - `web/lib/auth/clientSession.ts` - `useClientSession()` reads from `/api/auth/session`
   - `web/lib/auth/serverSession.ts` - Server-side session resolution

3. **Provider tokens**: Sanitized in `web/lib/tokenManager.ts`:
   - `sanitizePersistedStorage()` (line 471-498) strips `accessToken`/`refreshToken` from localStorage
   - `secretCache` keeps provider OAuth secrets in tab memory only; those values are not persisted to browser-visible storage, but they are still browser-runtime state
   - Persisted data contains only metadata + `remoteId`

4. **No reads from cf_token**: Grep confirmed no `localStorage.getItem('cf_token')` patterns exist for auth purposes.

## APP-10: Auth Noise Reduction

**Status**: Already fixed (CAC-69)

### Verification Findings

1. **AuthInterceptor behavior** (`web/lib/interceptors/authInterceptor.ts`):
   - Dispatches `cacheflow:session-expired` custom event instead of redirecting
   - Returns 401 response to caller instead of throwing
   - `shouldIncludeCredentials()` ensures same-origin requests include cookies

2. **SessionExpiredBannerHost** (`web/components/SessionExpiredBannerHost.tsx`):
   - Listens for `cacheflow:session-expired` events
   - Shows graceful UI banner instead of console errors
   - No direct navigation on 401

3. **Credentials handling**:
   - All same-origin fetches include `credentials: 'include'`
   - `apiFetch()` in `web/lib/api.ts` defaults to `credentials: 'include'`
   - API routes properly handle missing auth with 401 responses

4. **No noisy 401 logging**: No `console.error` calls for 401 responses found.

## APP-01: Upload Invalidation (Verify-Only)

**Status**: Already fixed

### Verification Findings

The upload flow in `web/components/UnifiedFileBrowser.tsx` properly invalidates and refreshes:

1. **Upload handler** (`handleUploadSelection`, lines 1126-1205):

   ```typescript
   // After successful upload:
   await metadataCache.invalidateCache(target.providerId, target.accountKey)
   setRefreshKey((k) => k + 1)
   ```


2. **Cache invalidation** (`web/lib/metadataCache.ts`):
   - `invalidateCache()` method properly clears IndexedDB entries
   - Supports provider-wide, account-wide, or folder-specific invalidation

3. **File list refresh**:
   - `refreshKey` change triggers `useEffect` to reload files
   - Uploaded files added to state immediately via `setFiles()`

4. **Consistent pattern** across mutations:
   - Create folder (line 1289): `invalidateCache` + `setRefreshKey`
   - Create file (line 1352): `invalidateCache` + `setRefreshKey`
   - Delete file (line 1389): `invalidateCache` + `setRefreshKey`
   - Rename file (line 1544): `invalidateCache` + `setRefreshKey`

## APP-09: Health Endpoint (Verify-Only)

**Status**: Already fixed (CAC-65)

### Verification Findings

The `/api/health` route exists at `web/app/api/health/route.ts`:

1. **Request**: `GET /api/health` (unauthenticated)

2. **Response shape**:

   ```json
   {
     "status": "ok" | "error",
     "timestamp": "2026-03-11T12:00:00.000Z",
     "memory": {
       "rss": number,
       "heapTotal": number,
       "heapUsed": number,
       "external": number
     },
     "uptime": number
   }
   ```


3. **Error response** (502 Bad Gateway when backend unreachable):

   ```json
   {
     "status": "error",
     "timestamp": "2026-03-11T12:00:00.000Z",
     "error": "Backend health service unavailable"
   }
   ```


4. **Implementation**:
   - Proxies to `http://127.0.0.1:8100/health`
   - 10-second timeout
   - Returns backend status unchanged on success
   - Returns 502 on timeout or connection failure

## Error Cases

| Error | HTTP Status | Response |
|-------|-------------|----------|
| Backend unreachable | 502 | `{ status: "error", error: "Backend health service unavailable" }` |
| Backend timeout | 502 | `{ status: "error", error: "Backend health service unavailable" }` |
| Backend error status | Forwarded | Returns backend response unchanged |

## Remaining Blockers

None for the Batch 1 storage/noise checks. A broader follow-up is still required if the project wants provider OAuth secrets removed from browser runtime memory and moved fully onto the server-backed vault path.

## Validation

```bash
cd /opt/docker/apps/cacheflow/web && npx tsc --noEmit
# Result: No errors
```

## References

- `docs/contracts/CAC-64.md` - SEC-01 implementation
- `docs/contracts/CAC-65.md` - APP-09 implementation
- `docs/contracts/CAC-69.md` - APP-10 implementation
- `docs/live-e2e-triage-matrix.md` - Triage tracking
