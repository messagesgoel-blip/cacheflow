## Sidebar Account Density

Date: 2026-03-08

Scope:
- tighten provider section headers and account row spacing in the files sidebar
- compact account icon, label, sublabel, and quota spacing
- keep sidebar navigation and quota behavior unchanged

Behavior:
- provider and account selection logic is unchanged
- quota bars and health dots remain in the same places with the same data
- this is a visual density pass only

Verification:
- `cd /opt/docker/apps/cacheflow/web && npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3037 npx playwright test e2e/fileActions.spec.ts --project=chromium`
