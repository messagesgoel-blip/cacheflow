# providers-surface-groups-20260308

## Scope
- tighten the providers page without backend changes
- separate cloud remotes from VPS/SFTP nodes so the page reads by operational type instead of one mixed card grid
- keep connect flows and existing provider modal selectors intact

## Changes
- grouped connected providers into `Cloud Remotes` and `VPS / SFTP Nodes`
- reduced visual noise in provider cards by simplifying action button styling and collapsing repetitive metadata
- split `Available Integrations` into cloud providers and server-side remotes
- added focused browser coverage for the grouped providers surface

## Verification
- `cd web && npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3010 npx playwright test e2e/providersSurface.spec.ts e2e/providerModals.spec.ts --project=chromium`

## Notes
- this pass is presentation-only; server-side connection loading, disconnect, test, and connect behavior remain unchanged
