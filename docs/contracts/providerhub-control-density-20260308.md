## ProviderHub Control Density

Date: 2026-03-08

Scope:
- tighten ProviderHub header rhythm and connect action styling
- compact provider summary cards and available integration cards
- keep provider card behavior, modal triggers, and VPS actions unchanged

Behavior:
- connect buttons still open the same provider modals
- provider card actions and disconnect/test/edit flows are unchanged
- this is a visual density pass only

Verification:
- `cd /opt/docker/apps/cacheflow/web && npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3039 npx playwright test e2e/providerModals.spec.ts --project=chromium`
