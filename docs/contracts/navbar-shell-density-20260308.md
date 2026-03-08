## Navbar Shell Density

Date: 2026-03-08

Scope:
- tighten navbar vertical rhythm to better match the sidebar shell
- compact the primary nav chips without changing routes or behavior
- reduce command palette trigger and user-session control bulk

Behavior:
- no route, auth, or palette-command behavior changed
- header controls keep the same test ids and interaction model
- this is a visual density pass only

Verification:
- `cd /opt/docker/apps/cacheflow/web && npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3036 npx playwright test e2e/commandPalette.spec.ts --project=chromium`
