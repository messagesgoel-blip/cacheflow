# Blocker: `security-verification-real.spec.ts` Failing on Missing IndexedDB Key

**Date**: 2026-03-03

**Agent**: Gemini

**Status**: The `security-verification-real.spec.ts` test suite is failing with a specific assertion error. All other phase-gate suites are passing, indicating the main QA seed data blocker is resolved.

## Problem Description
The test fails on the assertion `expect(hasF1, 'IndexedDB should have key for Filen F1').toBeTruthy()`. The test logs confirm that IndexedDB was successfully inspected, but the key for the Filen provider (`filen:qa-tester@filen.io:root`) was not found, while keys for Google and Dropbox were present.

This suggests a subtle issue in how the Filen mock provider interacts with the client-side caching layer, or a configuration mismatch in the test itself.

## Example Error
```
Error: IndexedDB should have key for Filen F1

expect(received).toBeTruthy()

Received: false

  148 |   expect(hasG2, 'IndexedDB should have key for Google G2').toBeTruthy()
  149 |   expect(hasD1, 'IndexedDB should have key for Dropbox D1').toBeTruthy()
> 150 |   expect(hasF1, 'IndexedDB should have key for Filen F1').toBeTruthy()
      |                                                           ^
  151 |
```

## Likely Owner
**OpenCode**, as this involves the provider implementation and its interaction with the client-side caching and security verification logic.

## Minimal Reproduction
1.  Run `npx playwright test e2e/security-verification-real.spec.ts --config=playwright.sprint1.config.ts`.
2.  Observe the test failure related to the missing IndexedDB key for the Filen provider.
