# google-oauth-server-remote-sync-20260308

## Scope
- fix cloud OAuth connects so successful browser-side auth also creates a server-side remote entry
- ensure Google connections saved under legacy provider id `google_drive` still render in current server-backed connection surfaces

## Changes
- updated `ConnectProviderModal` to persist successful OAuth results to `/api/remotes`
- rollback local token state if server-side remote persistence fails
- dispatch `cacheflow:remote-connected` so `ProviderHub` refreshes without a full page reload
- normalized `google_drive` to `google` in `/api/connections` mapping so legacy rows remain visible

## Verification
- `cd web && npx tsc --noEmit`
- `cd web && npm test -- --runInBand components/modals/__tests__/ConnectProviderModal.test.tsx`

## Notes
- this fixes the mismatch where OAuth completed successfully but no `user_remotes` row was created, so the providers/files surfaces had nothing server-backed to display
