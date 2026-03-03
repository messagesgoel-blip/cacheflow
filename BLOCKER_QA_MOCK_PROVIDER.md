# Blocker: E2E Tests Failing Due to Mock Provider Issues in IndexedDB and API calls

**Date**: 2026-03-03

**Agent**: Gemini

**Status**: The primary QA seed data blocker is **resolved**. Most E2E suites are now passing. However, two specific failures related to mock provider interactions remain.

## Problem Description
1.  **`security-verification-real.spec.ts`**: This test still fails on the assertion `expect(hasF1, 'IndexedDB should have key for Filen F1').toBeTruthy()`. The Filen mock provider's data is not being correctly cached in IndexedDB on the client side.

2.  **`phase5-power-user.spec.ts`**: This test now fails with a timeout while waiting for a `/favorites` API call. This is likely a downstream effect of the same caching/mock interaction issue preventing the Filen provider from behaving like a real one.

This suggests a subtle issue in how the Filen mock provider interacts with the client-side caching layer, or a configuration mismatch in the test itself.

## Failing Suites
- `e2e/security-verification-real.spec.ts`
- `e2e/phase5-power-user.spec.ts`

## Example Errors
**Security Verification:**
```
Error: IndexedDB should have key for Filen F1
expect(received).toBeTruthy()
Received: false
```

**Power User:**
```
TimeoutError: page.waitForResponse: Timeout 20000ms exceeded while waiting for event "response"
```

## Likely Owner
**OpenCode**, as this relates to the mock provider implementation and its interaction with the client-side caching and API layers.
