# Review Remediation Plan (2026-02-25)

This checklist tracks follow-up work from the comprehensive review.

## Completed in this pass

- [x] Fix documentation drift for architecture and endpoints
  - README corrected to Express backend
  - API reference updated to match implemented routes
- [x] Add API automated test coverage
  - Added `api/tests/app.test.js` for health + auth route behavior
  - Wired `api` test runner to Jest
- [x] Resolve client/server contract mismatch for conflict resolution
  - Frontend now uses `keep_remote` to match backend API contract
  - Removed unsupported `keep_both` option from conflict UI
- [x] Add centralized API configuration validation
  - Added `api/src/config.js`
  - API startup now validates required env and numeric settings
- [x] Apply safe dependency updates
  - API: upgraded `pg` to latest 8.x line
  - Web: upgraded `recharts` to latest 2.x and `next` to 14.2.35
- [x] Increase API and web unit/integration test breadth
  - Expanded API tests to cover files/storage/conflicts/admin route behavior
  - Added web Jest + Testing Library tests for conflict resolution UI interactions
- [x] Expand config management beyond API startup
  - Added worker config validation in `worker/config.js`
  - Added web runtime config validation in `web/lib/config.ts`
- [x] Complete dependency modernization requiring larger changes
  - Migrated web stack to Next.js 16.1.6 + React 19.2.4
  - Resolved high/critical web audit findings (`npm audit` now clean)

## Remaining items

- [ ] Complete naming consistency sweep
  - Standardize request/response naming across API and web DTOs
- [ ] Curate worker dependency modernization
  - Worker dependency graph still has many outdated transitive/direct packages
  - Requires a dedicated, staged upgrade plan with integration testing

## Immediate next suggested implementation order

1. Complete naming consistency sweep for API/web contracts.
2. Plan staged worker dependency upgrades (batch by risk/compatibility).
3. Add integration smoke tests for upgraded worker dependency batches.

