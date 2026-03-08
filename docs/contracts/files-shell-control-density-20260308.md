# Files Shell Control Density — 2026-03-08

## Why

The first typography pass over-applied mono and chip styling to the files toolbar and overflow actions. Compared against the sidebar and the reference screenshots, the controls read too loud and too detached from the rest of the shell.

## Changes

- Reduced the files toolbar from pill-heavy chips to a compact `Write Target` label/value treatment.
- Changed `New Folder`, `New File`, and `Upload` to compact UI-font buttons instead of loud uppercase mono pills.
- Changed the all-provider view/filter controls left of search to the same compact UI-font treatment:
  - `Grouped`
  - `Flat`
  - `Aggregated`
  - provider filter select
  - `Duplicates Only`
- Softened the selection toolbar action labels to match the rest of the shell.
- Reverted file-row metadata and overflow-menu actions to compact UI text instead of forced uppercase mono.

## Non-Goals

- No backend changes
- No file-browser behavior changes
- No sidebar layout changes

## Verification

- `cd web && npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3034 npx playwright test e2e/fileActions.spec.ts --project=chromium`
