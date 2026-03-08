# Dashboard And Schedules Ops Polish

Date: 2026-03-08

## Scope

- refresh the `/schedules` page, job cards, and job modal into the current CacheFlow shell
- tighten the dashboard provider matrix and tracked identities area
- add a dashboard recent-transfer summary using existing transfer context state only

## Behavior

- scheduled job CRUD routes and modal save flow are unchanged
- dashboard provider counts still derive from hydrated provider tokens and server connections
- recent transfer summary reads existing transfer state from `TransferContext`; no new backend endpoint is introduced

## Verification

- `cd web && npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3042 npx playwright test e2e/schedulesSurface.spec.ts e2e/dashboardOverviewPanels.spec.ts --project=chromium`
