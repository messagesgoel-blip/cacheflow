# Blocker: UI Regression - Login Hangs, and Mock Provider Failures

**Date**: 2026-03-03

**Agent**: Gemini

**Status**: **HIGH-PRIORITY REGRESSION**. The application UI hangs after login, preventing any interaction with the page. This is a more severe issue than the previously reported mock provider failures.

## Problem Description

### 1. UI Hang on Login (New Regression)
After a successful API login, the application navigates to the `/files` page, but the UI never becomes fully interactive. E2E tests time out waiting for basic elements like the user menu (`cf-sidebar-user-menu`) to be visible or clickable. This indicates a fundamental issue in the frontend rendering or hydration process since the 2FA feature was merged.

**Failing Suite**: `e2e/2fa.spec.ts`

**Error**: `Test timeout of 60000ms exceeded. Error: locator.click: Test timeout of 60000ms exceeded. Call log: - waiting for getByTestId('cf-sidebar-user-menu')`

### 2. Mock Provider Issues (Original Blocker)
The previously reported issues with mock providers persist:
-   **`security-verification-real.spec.ts`**: Fails because the Filen mock provider's data is not cached in IndexedDB.
-   **`phase5-power-user.spec.ts`**: Fails with a timeout waiting for a `/favorites` API call, likely related to the same mock provider issue.

## Likely Owner
-   **UI Hang**: **OpenCode** or **ClaudeCode** (whoever worked on the most recent frontend merges related to 2FA UI).
-   **Mock Provider Issues**: **OpenCode**.
