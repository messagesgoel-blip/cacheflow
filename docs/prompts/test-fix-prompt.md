# CacheFlow Test Fix Task

**Priority:** HIGH  
**Scope:** Fix ALL test failures to achieve green CI  
**Constraint:** NO code edits unless explicitly part of fix. Run tests after each fix to verify.

---

## Context

Test suite run on commit `a0300b2` produced failures across 3 suites:
- Jest unit tests: 7 failed (tokenVault TextEncoder issue)
- TypeScript: 40+ type errors
- Playwright E2E: 17 tests timing out (auth/token issues)

Artifacts at: `/srv/storage/local/test/20260306-101037/`

Set the repo root once before running the commands below:
```bash
CACHEFLOW_ROOT="$(git rev-parse --show-toplevel)"
```

---

## Task 1: Fix Jest TextEncoder Issue (CRITICAL)

### Problem
All 7 tests in `web/lib/vault/__tests__/tokenVault.test.ts` fail with:
```
ReferenceError: TextEncoder is not defined
```

Root cause: Jest Node environment doesn't expose Web Crypto API globals by default. The vault code at `web/lib/vault/tokenVault.ts:53` uses `new TextEncoder()`.

### Fix Required

**Option A (Recommended):** Add TextEncoder polyfill to Jest setup

1. Check if `web/jest.setup.ts` or `web/jest.config.js` exists
2. Add to setup file:
   ```ts
   import { TextEncoder, TextDecoder } from 'util'
   global.TextEncoder = TextEncoder
   global.TextDecoder = TextDecoder
   ```
3. Ensure setup file is referenced in `jest.config.js`:
   ```js
   setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']
   ```

**Option B:** Mock at test file level
Add to top of `tokenVault.test.ts`:
```ts
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
```

### Verification
```bash
cd "$CACHEFLOW_ROOT/web"
npm test -- tokenVault.test.ts
```
Expected: All 7 tokenVault tests PASS

---

## Task 2: Fix TypeScript Type Errors

### 2.1 Install Missing ssh2 Module

**Files affected:**
- `lib/providers/vps/VPSAdapter.ts`
- `lib/providers/vps/sshConnectionManager.ts`

**Errors:**
```
error TS2307: Cannot find module 'ssh2'
error TS7006: Parameter 'err' implicitly has an 'any' type
```

**Fix:**
```bash
cd "$CACHEFLOW_ROOT/web"
npm install ssh2 @types/ssh2
```

Then add explicit types to callback parameters:
```ts
// Before
sftp.connect(config, (err, sftp) => {

// After
sftp.connect(config, (err: Error | null, sftp: ClientChannel) => {
```

### 2.2 Fix Type Export Issues

**File:** `lib/placement/autoPlacementEngine.ts`

**Errors:**
```
error TS1205: Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'
```

**Fix:** Change line 438 from:
```ts
export { PlacementResult, PlacementStrategy, Bin, Item }
```
To:
```ts
export type { PlacementResult, PlacementStrategy, Bin, Item }
```

### 2.3 Fix Downlevel Iteration Errors

**Files:**
- `lib/placement/autoPlacementEngine.ts:270`
- `lib/transfer/jobQueue.ts:66`
- `lib/transfer/rateLimitQueue.ts:26,42,61`

**Fix Option A:** Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "downlevelIteration": true
  }
}
```

**Fix Option B:** Replace iteration with Array.from:
```ts
// Before
for (const job of map.values()) {

// After
for (const job of Array.from(map.values())) {
```

### 2.4 Fix Vault Type Mismatches

**File:** `lib/vault/tokenVault.ts`

**Errors:**
```
error TS2339: Property 'iv' does not exist on type 'VaultEntry'
error TS2339: Property 'accountOrder' does not exist on type 'VaultAccount'
```

**Fix:** Check `VaultEntry` and `VaultAccount` interface definitions. Add missing properties:
```ts
interface VaultEntry {
  // ... existing
  iv: string  // Add this
}

interface VaultAccount {
  // ... existing
  accountOrder?: string[]  // Add this if optional
}
```

### 2.5 Fix File Aggregator Test Types

**File:** `__tests__/fileAggregator.test.ts`

**Errors:**
```
error TS2741: Property 'pathDisplay' is missing in type...
```

**Fix:** Add `pathDisplay` property to all mock file objects in tests:
```ts
const mockFile: AggregatedFileItem = {
  // ... existing
  pathDisplay: '/mock/path',  // Add this
}
```

### 2.6 Fix Export Issues

**Files:**
- `components/Sidebar/index.tsx` - Missing Sidebar export
- `components/share/ShareLinkList.tsx` - ShareLink export issue

**Fix:** Check actual file exports and fix imports to match.

### Verification
```bash
cd "$CACHEFLOW_ROOT/web"
npx tsc --noEmit
```
Expected: ZERO errors

---

## Task 3: Fix Playwright E2E Auth Issues

### Problem Pattern
```
[BROWSER] Failed to load resource: 401 Unauthorized
[BROWSER] Failed to load resource: 500 Internal Server Error
[BROWSER] [TokenManager] No refresh callback for google
```

Tests timing out:
1. `e2e/correlation-diagnostic.spec.ts`
2. `e2e/fileActions.spec.ts` (Upload/New Folder)
3. `e2e/files-states.spec.ts`
4. `e2e/localhost-qa.spec.ts`
5. `e2e/modal-fix-verification.spec.ts`
6. `e2e/multi-account-isolation.spec.ts`

### Investigation Steps

1. **Check TokenManager implementation:**
   - Find where refresh callbacks are registered
   - Verify `google` provider has callback registered before use

2. **Check auth flow in tests:**
   - Verify login happens before API calls
   - Check if auth cookies are being set correctly

3. **Check API server:**
   - Verify API is running at expected port during tests
   - Check for 500 errors in API logs

### Likely Fixes

**Fix A:** Ensure TokenManager callback registration
```ts
// In test setup or TokenManager init
tokenManager.setRefreshCallback('google', async (token) => {
  // refresh logic
})
```

**Fix B:** Add auth wait in tests
```ts
// Before making API calls in tests
await page.waitForFunction(() => {
  return localStorage.getItem('auth_token') !== null
})
```

**Fix C:** Increase test timeout
In `playwright.config.ts`:
```ts
timeout: 60000,  // Increase from default
```

### Verification
```bash
cd "$CACHEFLOW_ROOT/web"
npx playwright test --project=chromium --grep "localhost login"
```
Expected: Test completes without 401/500 errors

---

## Execution Order

1. **Task 1** (TextEncoder) - 5 min fix, immediate verification
2. **Task 2.1** (ssh2 install) - 1 min fix
3. **Task 2.2-2.6** (Type errors) - 15 min fix
4. **Task 3** (E2E auth) - May require investigation

---

## Success Criteria

```bash
# All must pass:
cd "$CACHEFLOW_ROOT/web"

# 1. Jest tests
npm test  # 0 failures

# 2. TypeScript
npx tsc --noEmit  # 0 errors

# 3. Playwright (sample)
npx playwright test e2e/localhost-qa.spec.ts  # Completes without timeout
```

---

## Files to Reference

- Test logs: `/srv/storage/local/test/20260306-101037/*.log`
- Full report: `/srv/storage/local/test/20260306-101037/REPORT.md`
- Error context: `/srv/storage/local/test/20260306-101037/error-context.md`

---

## Important Notes

- Do NOT suppress type errors with `@ts-ignore` or `as any`
- Do NOT delete failing tests
- Do NOT change test expectations to match broken behavior
- Fix ROOT CAUSES only
- After each fix category, run verification command
- If stuck on E2E auth: check `web/lib/auth/` and `web/lib/tokenManager.ts`

---

**This is an audit-only prompt: review all tasks and report proposed changes; begin execution only after explicit approval. The audit-only constraint applies to all tasks in this prompt until explicit approval is given.**
