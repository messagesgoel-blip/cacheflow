## Task

Final providers page action hierarchy pass.

## Scope

- Refined `web/components/ProviderHub.tsx` summary density so connected, protocol, and connectable state read as one compact control-plane overview.
- Rebalanced provider card action emphasis to make primary server actions clearer while preserving existing button labels, selectors, and modal entry points.
- Tightened available integration grouping to separate cloud and server connect surfaces without changing routes or focused test hooks.

## Validation

- `cd /opt/docker/apps/cacheflow/web && npx tsc --noEmit`
- `cd /opt/docker/apps/cacheflow/web && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3049 npx playwright test e2e/providersSurface.spec.ts e2e/providerModals.spec.ts`
