# Dashboard Quick Actions

Date: 2026-03-08

## Scope

- add a compact dashboard quick-actions panel based on the example UI action-grid pattern
- keep actions limited to existing CacheFlow routes
- place the panel next to onboarding so the dashboard keeps a clear operations lane

## Behavior

- actions link only to real routes:
  - `/files`
  - `/providers`
  - `/schedules`
  - `/settings/security`
- no backend calls or product capabilities are added
- onboarding and dashboard hero behavior remain unchanged

## Verification

- `cd web && npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3041 npx playwright test e2e/dashboardQuickActions.spec.ts --project=chromium`
