# URM-7 UI Glass Refresh

Date: 2026-03-10

Scope:
- Port the `os1`-inspired glass shell language into the CacheFlow frontend.
- Keep all existing backend contracts, auth behavior, and data-loading flows unchanged.
- Limit changes to frontend shell, layout, typography, and presentational components under `web/`.

Included surfaces:
- global shell tokens and typography
- files shell and sidebar
- mission control and storage overview cards
- transfer tray and transfer queue surfaces

Explicit non-goals:
- no API route changes
- no auth/session changes
- no provider token storage changes
- no database, worker, or queue contract changes

Verification:
- `cd web && npx tsc --noEmit`
- `cd web && npm test -- --runInBand components/__tests__/UnifiedFileBrowser.test.ts __tests__/jobsLogs.test.js lib/hooks/__tests__/useQuotaAlerts.test.tsx`
- `cd web && npm run build`

Follow-up polish scope:
- convert the files sidebar into a proper mobile drawer so the workspace no longer renders underneath it on narrow screens
- move the session-expired banner into shell flow instead of covering the navbar
- tighten the files loading state layout and toolbar rhythm
- raise light-theme contrast for shell labels and secondary text
- reskin the login surface to match the deployed glass shell without changing auth behavior
