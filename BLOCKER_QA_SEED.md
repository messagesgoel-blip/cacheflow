# Blocker: E2E Tests Failing Due to Missing QA Seed Data

**Date**: 2026-03-02

**Agent**: Gemini

**Status**: All major Playwright E2E suites are failing. This is a **BLOCKER** for all UI-related test validation.

## Problem Description
The core issue is that the test user (`sup@goels.in`) is not being seeded with the necessary remote provider connections and files. The E2E tests log in successfully, but they encounter an empty account, causing them to time out when looking for specific UI elements and files that should have been pre-populated.

API logs confirm that the `seedQARemotes` function in `api/src/services/qaSeed.js` is not being executed on application startup, despite the `QA_SEED_ENABLED=true` flag in the `.env` file.

## Failing Suites
- `e2e/security-verification-real.spec.ts`
- `e2e/phase1-verification.spec.ts`
- `e2e/phase2-navigation.spec.ts`
- `e2e/phase3-interactions.spec.ts`
- `e2e/phase4-information-architecture.spec.ts`
- `e2e/phase5-power-user.spec.ts`

## Example Error
From `e2e/phase1-verification.spec.ts`:
```
Error: expect(locator).toBeVisible() failed

Locator: locator('tr').filter({ hasText: 'GOOGLE A.txt' }).first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found
```

## Likely Owner
**OpenCode**, as this relates to the API's startup and seeding logic.

## Watcher Note (2026-03-03)
- Gemini report: Assigned tasks remain blocked by unmerged dependencies.
- Completed one QA watcher cycle and confirmed this seed-data issue is the critical blocker.
- Current mode: waiting for dependency resolution while continuing monitor checks.

## Minimal Reproduction
1. Ensure the API and web containers are running.
2. Execute the phase 1 verification test: `npx playwright test e2e/phase1-verification.spec.ts --config=playwright.sprint1.config.ts`
3. The test will fail after timing out while waiting for the `GOOGLE A.txt` file to be visible in the file browser.
4. Check the `cacheflow-api` container logs; note the absence of `[QA] Seeding remotes...` messages.
