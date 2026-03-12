# V1-4-GM-B1: SPEC Fixes Verification

## Summary

Batch 1 verification for the CacheFlow V1-4 live E2E triage hold - Gemini spec fixes.

**Result**: The batch mixed verify-only findings with real spec fixes. Targeted E2E files were updated to match the current UI and mock payload shape.

## Scope

- SPEC-01: Invalid comma locator syntax (AUTH-1)
- SPEC-02: Nav label reconciliation (NAV-1)
- SPEC-04: Row-selection checkbox assumptions (ACTIONS-1)
- SPEC-06: Search route/embedded surface (SEARCH-1)
- SPEC-07: Replace page.evaluate(fetch) patterns (verify-only)
- SPEC-08: Replace browser-context fetches losing cookies (verify-only)
- SPEC-09: Login-page selectors (L-02)
- SPEC-10: Connections-page card measurement (L-03)
- SPEC-11: Sticky-nav topbar element targeting (L-07)

## Files Reviewed

| File | Purpose | Status |
|------|---------|--------|
| `web/e2e/helpers/mockRuntime.ts` | Mock connections payload shape | Updated to return `{ success, data }` wrapper |
| `web/e2e/layoutDispatch1.spec.ts` | Layout and dispatch tests | Updated selectors and deterministic waits |
| `web/e2e/providersSurface.spec.ts` | Provider surface tests | Updated headings to role-based selectors |
| `web/e2e/real-ui-operations.spec.ts` | Real UI operation tests | Switched selection lookups to checkbox roles |
| `web/e2e/phase3-interactions.spec.ts` | Phase 3 interaction tests | Added mobile-dock handling and post-transfer dismissal |
| `web/e2e/securityAudit.spec.ts` | Security audit tests (SPEC-07/08) | Already using correct patterns |
| `web/e2e/real-auth-relogin.spec.ts` | Auth relogin tests (SPEC-07/08) | Already using correct patterns |

## SPEC Items Analysis

### SPEC-01: Invalid Comma Locator Syntax

**Status**: Fixed

**Findings**:
- Searched for CSS-style comma selectors (e.g., `'.class1, .class2'`) in Playwright locators
- All locators in the targeted files use valid Playwright syntax:
  - `page.getByRole('navigation')`
  - `page.getByTestId('cf-sidebar-account-g1')`
  - `page.locator('tr', { hasText: folderName })` - valid Playwright locator with options
- The login layout assertions were updated to target the actual hero/form sections instead of positional `nth()` selectors

### SPEC-02: Nav Label Reconciliation

**Status**: Fixed

**Findings**:
- Navbar.tsx defines nav items: 'Files', 'Your Drives', 'Conflicts', 'Admin'
- layoutDispatch1.spec.ts line 365 uses `getByRole('navigation').filter({ hasText: /CacheFlow/i })`
- providersSurface.spec.ts uses correct headings: 'Connected Providers', 'Available Integrations', 'Cloud Providers', 'Server-side Remotes'
- Added mobile-dock opening in `phase3-interactions.spec.ts` so sidebar provider assertions work on narrow layouts
- Updated providers surface heading assertions to use role-based headings instead of broad text matches

### SPEC-04: Row-Selection Checkbox Assumptions

**Status**: Fixed

**Findings**:
- UnifiedFileBrowser.tsx line 2159-2167: File rows use `<input type="checkbox" data-testid="cf-row-checkbox">`
- `real-ui-operations.spec.ts` now uses `getByRole('checkbox')` consistently for row selection

### SPEC-06: Search Route vs Embedded Surface

**Status**: Verify-only - Correctly handled

**Findings**:
- Search is embedded in UnifiedFileBrowser component (not a separate route)
- Input has `data-testid="cf-global-search-input"` at line 1883
- real-ui-operations.spec.ts line 43-47 correctly handles with fallback chain:
  ```typescript
  const search = page.getByTestId('cf-global-search-input')
    .or(page.locator('input[placeholder*="Search"]'))
    .or(page.locator('input[aria-label*="Search"]'))
    .or(page.locator('input[type="search"]'))
    .first()
  ```

### SPEC-07: Replace page.evaluate(fetch) Patterns

**Status**: Already satisfied

**Findings**:
- securityAudit.spec.ts line 19: `page.request.get(candidate, { failOnStatusCode: false })`
- securityAudit.spec.ts line 104: `page.request.post(...)`
- real-auth-relogin.spec.ts line 24: `page.request.get('/api/auth/session')`
- No `page.evaluate(fetch(...))` patterns found
- All API calls use `page.request.*` which preserves session context

### SPEC-08: Browser-Context Fetches Losing Cookies

**Status**: Already satisfied

**Findings**:
- Same files as SPEC-07
- securityAudit.spec.ts uses `page.request.get()` and `page.request.post()` for all API calls
- This preserves HttpOnly cookies and session context
- No browser-context fetch patterns that would lose session cookies

### SPEC-09: Login-Page Selectors

**Status**: Fixed

**Findings**:
- Login.tsx has correct testids:
  - Line 94: `data-testid="email-input"`
  - Line 106: `data-testid="password-input"`
  - Line 117: `data-testid="submit-button"`
  - Line 124: `data-testid="toggle-mode-button"`
- `layoutDispatch1.spec.ts` now uses the live heading text with regex matching and the real email-input test hook

### SPEC-10: Connections-Page Card Measurement

**Status**: Fixed

**Findings**:
- `layoutDispatch1.spec.ts` now waits for visible cards instead of using a hard timeout
- `phase3-interactions.spec.ts` dismisses completed transfer cards before later hover assertions

### SPEC-11: Sticky-Nav Topbar Targeting

**Status**: Fixed

**Findings**:
- Navbar.tsx line 26: Uses `<nav className="sticky top-0...">`
- `layoutDispatch1.spec.ts` now targets the sticky navbar via `getByRole('navigation')`

## SPEC IDs Fixed vs Verify-Only

| ID | Status | Notes |
|----|--------|-------|
| SPEC-01 | Fixed | Replaced positional login layout selectors with stable section filters |
| SPEC-02 | Fixed | Updated provider/nav assertions and mobile-dock handling |
| SPEC-04 | Fixed | Standardized row selection on checkbox roles |
| SPEC-06 | Verify-only | Search embedding handled correctly |
| SPEC-07 | Already satisfied | Uses `page.request.*` throughout |
| SPEC-08 | Already satisfied | Uses `page.request.*` throughout |
| SPEC-09 | Fixed | Login heading selector updated to current copy |
| SPEC-10 | Fixed | Removed hard wait and stabilized transfer/layout assertions |
| SPEC-11 | Fixed | Sticky-nav assertion now targets navigation role |

## Remaining App-Side Blockers

None. The remaining open items in the triage matrix are outside this batch (`SPEC-03`, `SPEC-05`, and post-rerun verification work).

## Validation Performed

### TypeScript Check
```bash
cd /opt/docker/apps/cacheflow/web && npx tsc --noEmit
# Result: No errors
```

### Repo Diff Review
- Verified targeted edits in `layoutDispatch1.spec.ts`, `phase3-interactions.spec.ts`, `providersSurface.spec.ts`, `real-ui-operations.spec.ts`, and `helpers/mockRuntime.ts`
- Confirmed `securityAudit.spec.ts` and `real-auth-relogin.spec.ts` already used `page.request.*`

## Notes for Live Run

1. **Mock payload alignment**: `helpers/mockRuntime.ts` now mirrors the live `/api/connections` response envelope, which keeps provider-surface tests aligned with the current API shape.

2. **Search is embedded**: Future tests should use `data-testid="cf-global-search-input"` as the primary selector for the search input.

3. **File row selection**: Use either `getByRole('checkbox')` or `getByTestId('cf-row-checkbox')` - both work correctly.

## References

- `docs/live-e2e-triage-matrix.md` - Triage tracking
- `docs/contracts/V1-4-OC-B1.md` - OpenCode batch 1 results
- `docs/contracts/V1-4-CC-B1.md` - ClaudeCode batch 1 results
