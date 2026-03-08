# transfers-palette-activity-crosslinks-20260308

## Scope
- converge schedules with existing transfer surfaces using current client transfer state only
- refine the shell command palette with direct activity and schedule-compose entry points
- cross-link dashboard activity into the addressable files activity workspace without backend changes

## Changes
- added `/files?view=activity` routing into the files workspace and synchronized `UnifiedFileBrowser` to that route state
- added palette commands for opening the activity feed and composing a new scheduled job
- added a dashboard recent activity panel backed by the existing `/api/activity` response
- added a schedules transfer snapshot panel backed by the existing `TransferContext`
- kept all work inside current client state and existing APIs

## Verification
- `cd web && npx tsc --noEmit`
- focused Playwright:
  - `e2e/commandPalette.spec.ts`
  - `e2e/dashboardOverviewPanels.spec.ts`
  - `e2e/schedulesSurface.spec.ts`
