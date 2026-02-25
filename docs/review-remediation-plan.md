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

## Remaining items

- [ ] Increase API and web unit/integration test breadth
  - Target files/storage/conflicts/admin routes and core UI interactions
- [ ] Expand config management beyond API startup
  - Add similar validation patterns for worker and web runtime config
- [ ] Complete naming consistency sweep
  - Standardize request/response naming across API and web DTOs
- [ ] Complete dependency modernization requiring larger changes
  - Web still has a high advisory in `next` requiring major upgrade to 16.x
  - Worker dependency graph needs a curated upgrade pass (many major-version jumps)

## Immediate next suggested implementation order

1. Add API tests for file browser/storage/conflicts routes with mocked DB.
2. Add worker config validation module and startup checks.
3. Plan and execute Next.js 14 -> 16 migration in a dedicated branch with regression tests.
