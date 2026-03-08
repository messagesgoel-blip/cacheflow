# dashboard-settings-vps-polish-20260308

## Scope
- tighten dashboard hero/stat-card rhythm
- reduce settings and security surface density without changing preference or 2FA behavior
- align the VPS detail browser route with the current shell styling while preserving existing QA actions

## Changes
- refined `StorageHero` spacing, usage summary, and priority-provider presentation
- tightened settings cards, rows, and page-level profile/security side panels
- compacted 2FA summary and setup sections while preserving the existing flow and button labels
- restyled `/providers/vps/[id]` into the current shell with path, guardrail, and directory summary cards
- added a mocked browser spec for the VPS detail surface

## Verification
- `cd web && npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3046 npx playwright test e2e/dashboardHero.spec.ts e2e/settingsSurface.spec.ts e2e/2fa.spec.ts e2e/vpsDetailSurface.spec.ts --project=chromium`

## Notes
- this pass is presentation-only; dashboard data sources, settings persistence, 2FA endpoints, and VPS file operations remain unchanged
