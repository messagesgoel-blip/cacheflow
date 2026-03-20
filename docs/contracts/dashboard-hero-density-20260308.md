## Dashboard Hero Density

Date: 2026-03-08

Scope:
- tighten dashboard hero spacing, heading scale, and stat-card rhythm
- compact the provider matrix and top dashboard summary cards
- keep dashboard data sources, labels, and quota calculations unchanged

Behavior:
- pooled storage math and displayed values are unchanged
- onboarding and dashboard navigation are unchanged
- this is a visual density pass only

Verification:
- `cd /srv/storage/repo/cacheflow/web && npx tsc --noEmit`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3038 npx playwright test e2e/dashboardHero.spec.ts --project=chromium`
