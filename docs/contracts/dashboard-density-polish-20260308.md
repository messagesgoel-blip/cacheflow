## Task

Dashboard stat cards and provider summary density polish.

## Scope

- Refined `web/components/dashboard/StorageHero.tsx` to condense the pooled storage hero into tighter overview, usage, and quota coverage zones.
- Updated `web/app/dashboard/page.tsx` to replace redundant stat cards with denser provider summary and footprint rails.
- Preserved existing route, headings, and dashboard hero test-visible copy.

## Validation

- `cd /opt/docker/apps/cacheflow/web && npx tsc --noEmit`
- `cd /opt/docker/apps/cacheflow/web && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3049 npx playwright test e2e/dashboardHero.spec.ts`
