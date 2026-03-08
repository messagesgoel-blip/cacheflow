# Live VPS Auth Regression - 2026-03-07

## Scope

- Fix production login for mixed-case email input.
- Remove remaining first-run flake from live VPS `mock run` traversal in Playwright.

## Changes

- Backend auth now normalizes email with `trim().toLowerCase()` for register, login, and test-user seed.
- Next login proxy now forwards normalized email and persists normalized fallback user data.
- Live VPS Playwright traversal now waits for idle state and retries once with refresh on transient missing folder rows.

## Validation

- `cd api && TOKEN_ENCRYPTION_KEY=... npm test -- --runInBand`
- `cd web && npm test -- --runInBand`
- `cd web && npx tsc --noEmit`
- Live deploy updated `cacheflow-api` and `cacheflow-web`.
- Live login check passed for `admin@Cacheflow.goels.in`.
- Live Playwright passed against `https://cacheflow.goels.in`:
  - `transfer modal stays inside mock run`
  - `copy and move stay green inside mock run`

