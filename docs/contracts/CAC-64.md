# CAC-64

## Scope

SEC-01 follow-up to remove browser-visible auth state after the runtime moved to cookie-backed sessions.

This contract now covers two slices:

- `SEC-01A`: remove Playwright and browser-unit-test dependence on legacy `cf_token` / `cf_email`
- `SEC-01B` partial: stop persisting provider OAuth tokens in `localStorage` and move the client connection model to metadata plus `remoteId`

## Changes

- Updated `web/e2e/helpers/mockRuntime.ts` so `primeQaSession()` seeds `accessToken` and `userData` cookies for `localhost` and `127.0.0.1`, mocks `/api/auth/session`, and only clears legacy localStorage keys.
- Updated `web/e2e/tests/vault.spec.ts` to use the cookie/session fixture instead of writing auth tokens into localStorage.
- Updated `web/lib/providers/__tests__/vps.test.ts` to stop seeding `cf_token` and to assert the current VPS provider request shape, which no longer injects a browser-side Bearer header.
- Refactored `web/lib/tokenManager.ts` so `cacheflow_tokens_*` persistence stores only sanitized provider metadata plus `remoteId`; live provider secrets remain in memory for the current tab only.
- Added `web/lib/__tests__/tokenManager.test.ts` to verify persisted token sanitization and remote-backed validity without browser-stored tokens.
- Updated `web/components/RemotesPanel.tsx`, `web/components/DrivePanel.tsx`, `web/components/Sidebar.tsx`, and `web/components/Sidebar/AccountRow.tsx` to treat `remoteId` as the connected state and stop depending on persisted access tokens.
- Updated `web/lib/providers/webdav.ts` so the WebDAV config persistence no longer stores the password in `localStorage`; only non-sensitive metadata is retained.
- Updated `web/components/modals/WebDAVModal.tsx`, `web/app/api/connections/route.ts`, `web/lib/apiClient.ts`, `web/components/UnifiedFileBrowser.tsx`, and `api/src/routes/userRemotes.js` so WebDAV now uses the server-backed `user_remotes` model with `remoteId`, safe URL metadata, and provider-aware proxy auth (`Basic` for WebDAV, `Bearer` elsewhere).
- Updated `web/lib/providers/webdav.ts` so WebDAV requests prefer the server-backed remote proxy path and only fall back to in-memory direct credentials when no `remoteId` exists.
- Updated `web/app/api/auth/2fa/verify/route.ts` and `web/app/auth/2fa-challenge/page.tsx` so the post-2FA session token is set only as an HttpOnly cookie server-side instead of being returned to the client and written with `document.cookie`.

## Verification

- `cd web && npx tsc --noEmit`
- `cd web && npx jest web/lib/providers/__tests__/vps.test.ts --runInBand`
- `cd web && npx playwright test e2e/tests/vault.spec.ts`
- `cd web && npx jest lib/__tests__/tokenManager.test.ts --runInBand`
- `rg -n "cf_token|cf_email" web/e2e web/lib/providers/__tests__ --glob '!**/node_modules/**'`

## Result

The only remaining `cf_token` / `cf_email` references under `web/e2e` are legacy cleanup calls in `primeQaSession()`. There are no remaining test fixtures that authenticate by writing those keys into browser storage.

Persisted `cacheflow_tokens_*` data is now sanitized on save and on startup migration, so provider `accessToken` / `refreshToken` values are no longer retained in browser-visible storage.

## Remaining Scope

- The current `SEC-01B` cut does not yet remove every provider credential path from runtime memory; it removes persistence to browser storage.
- WebDAV is now wired to the server-backed remote flow, but this pass did not include a dedicated live WebDAV integration test; the WebDAV path is currently verified by type-check and code-level proxy coverage only.
- `web/lib/vault/tokenVault.ts` still contains an older client-side vault-key derivation path that is not part of the active runtime auth/session flow; it was left out of this commit to avoid mixing dead-code crypto redesign into the auth-storage migration.
