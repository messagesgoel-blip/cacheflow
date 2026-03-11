# URM-68: Spec-only Live E2E Fixes

## Scope
Implementation of spec-only fixes identified in `docs/live-e2e-triage-matrix.md`. These fixes address test-file defects or stale assumptions in the Playwright suite and do not touch runtime app code.

### Tasks
- **SPEC-01**: Replace invalid comma locator syntax with `.or()` or equivalent valid Playwright locator composition in `AUTH-1`.
- **SPEC-02**: Reconcile expected nav labels with the actual live shell DOM in `NAV-1`.
- **SPEC-04**: Use `role="checkbox"` / custom control for row selection instead of native checkboxes in `ACTIONS-1`.
- **SPEC-06**: Update `SEARCH-1` to reflect whether search is a route or embedded surface.
- **SPEC-07**: Replace `page.evaluate(fetch(...))` from `about:blank` with `page.request.*` in security tests.
- **SPEC-08**: Replace browser-context fetches that lose session cookies with `page.request.*` in `MEDIA-1`, `PROVIDER PARITY`, `ZERODISK-1`, `HEALTH`.
- **SPEC-09**: Update login-page selectors to match the actual mounted auth layout and wait strategy in `L-02`.
- **SPEC-10**: Update connections-page card measurement logic and stabilization waits in `L-03`.
- **SPEC-11**: Target the real topbar element for sticky-nav checks in `L-07`.

### Excluded
- **SPEC-03**: Blocked on `APP-01`.
- **SPEC-05**: Blocked on `APP-01`.

## Verification
- Run modified Playwright specs using `npx playwright test <spec-file>`.
- Verify no TypeScript regressions with `cd web && npx tsc --noEmit`.
