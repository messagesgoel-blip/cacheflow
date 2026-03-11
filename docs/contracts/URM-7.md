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

Dispatch 1 layout fixes:
- `MissionControl` status row now uses fixed proportional columns (`1fr 2fr 1.2fr`) with stretched card heights so `Control Plane`, `Provider Breakdown`, and `Total Pooled Storage` align on the same bottom edge.
- the login entry surface keeps both hero and form cards vertically centered with matched desktop bottoms
- `/connections` now renders connection cards in a two-column desktop grid with `min-height` protection and bottom padding to avoid trailing dead space
- sidebar VPS quota rows replace `0 B · 0%` with a neutral placeholder bar and `No usage data`
- the mobile files toolbar drops the `Views / Search / Actions` labels, keeps the write target truncated inline, and collapses the default controls into a compact two-row layout with search expanding on demand
- `ProviderHub` integration cards stretch to equal height and keep `Connect` buttons bottom-aligned within each provider group

Dispatch 1 screenshot gate:
- local verification spec: `cd web && npx playwright test e2e/layoutDispatch1.spec.ts --config playwright.dispatch.config.ts`
- screenshots saved under `/srv/storage/screenshots/cacheflow/layout-dispatch1`
- captured files:
  - `dispatch1_login_desktop.png`
  - `dispatch1_dashboard_status_desktop.png`
  - `dispatch1_connections_desktop.png`
  - `dispatch1_files_sidebar_desktop.png`
  - `dispatch1_files_toolbar_mobile.png`
  - `dispatch1_providers_integrations_desktop.png`
