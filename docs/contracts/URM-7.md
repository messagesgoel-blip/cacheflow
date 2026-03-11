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
