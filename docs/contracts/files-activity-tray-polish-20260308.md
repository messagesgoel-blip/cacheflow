# files-activity-tray-polish-20260308

## Scope
- tighten the files header and search/filter/action bar without changing file-browser behavior
- refine full activity feed cards and dashboard activity cards to match the current shell density
- move the global transfer tray onto the same shell language as the rest of the app

## Changes
- grouped file-surface controls into compact `Views`, `Search`, and `Actions` toolbar cards
- kept existing file actions and selectors intact while reducing visual noise in toggles and filters
- tightened activity feed timestamp, filter, and event card presentation
- refreshed dashboard recent-activity cards with a stronger compact event-row treatment
- restyled the global transfer tray and transfer items to use shell tokens instead of the legacy white-card UI

## Verification
- `cd web && npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3045 npx playwright test e2e/fileActions.spec.ts e2e/aggregation.spec.ts e2e/activityFeed.spec.ts e2e/dashboardOverviewPanels.spec.ts e2e/transferTray.spec.ts --project=chromium`

## Notes
- this pass is presentation-only; transfer routes, file actions, search behavior, and dashboard/activity navigation remain unchanged
