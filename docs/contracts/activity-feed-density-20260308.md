# Activity Feed Density

Date: 2026-03-08

## Scope

- tighten the activity header and filter rhythm to match the compact shell language
- reduce heavy mono and uppercase treatment on filter controls, badges, and metadata chips
- keep the existing activity API contract and file-surface navigation unchanged

## Behavior

- `ActivityFeed` still loads from `/api/activity` with the same `action` and `provider` filters
- timeline entries still expose the same `data-testid` hooks for per-item assertions
- provider and size metadata remain visible, but use quieter compact chips instead of loud operational pills

## Verification

- `cd web && npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3040 npx playwright test e2e/activityFeed.spec.ts --project=chromium`
