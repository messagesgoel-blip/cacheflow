# VPS Drift + Unified Browser Create Actions

Date: 2026-03-07

Scope:
- Add VPS fingerprint drift warning on saved-node re-test.
- Add `New Folder` to the unified file browser.
- Add starter-file creation for common file types in the unified file browser.

Behavior:
- `POST /api/providers/vps/:id/test` now returns:
  - `hostFingerprint`
  - `previousHostFingerprint`
  - `fingerprintChanged`
- Provider cards warn when a newly tested VPS fingerprint differs from the previously stored fingerprint.
- Unified browser toolbar exposes:
  - `New Folder`
  - `New File`
- Folder row overflow menus expose:
  - `New Folder Here`
  - `New File Here`
- Folder row overflow actions no longer bubble into the folder row click handler, so targeting `New Folder Here` / `New File Here` does not implicitly navigate into that folder.
- `New File` supports starter templates:
  - `.txt`
  - `.md`
  - `.json`
  - `.csv`
  - `.html`
  - `.js`
  - `.ts`
  - `.tsx`
  - `.css`
  - `.xml`
- Folder/file creation uses existing provider adapter methods and current scoped folder path.
- Row-menu create actions target the selected folder row instead of the current breadcrumb root.
- VPS create actions emit the existing `cacheflow:vps-files-changed` event so cached views refresh correctly.

Verification:
- `cd web && npx tsc --noEmit`
- `cd web && npm test -- --runInBand`
- `cd api && TOKEN_ENCRYPTION_KEY=... npm test -- --runInBand`
- Live Playwright saved-VPS mock-run smoke for folder and starter-file creation.
- Live Playwright row-menu create path:
  - `folder row menu can create into that folder with extended starter templates`
