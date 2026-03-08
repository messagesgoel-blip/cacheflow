# Files Shell Typography Unification — 2026-03-08

## Scope

Align the main files window with the sidebar typography and shell treatment without changing backend behavior or file-browser workflows.

## Changes

- Extended shared shell utility classes in `web/app/globals.css` for:
  - micro labels
  - chips
  - toolbar cards
- Updated `web/components/UnifiedBreadcrumb.tsx` to use the same mono label and pill language as the sidebar.
- Updated `web/components/UnifiedFileBrowser.tsx` to:
  - add write-scope chips in the files toolbar
  - tighten the search/control cluster styling
  - convert the error banner to shell-native styling
  - normalize section headers to the shared label language
  - tighten row metadata and overflow menu typography
- Updated `web/components/SelectionToolbar.tsx` to match the same shell card/button treatment.

## Non-Goals

- No provider API changes
- No file action behavior changes
- No navigation or auth changes

## Verification

- `cd web && npx tsc --noEmit`
- Focused Playwright on `web/e2e/fileActions.spec.ts`
