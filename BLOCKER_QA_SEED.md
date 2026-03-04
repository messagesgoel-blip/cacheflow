# QA Seed Blocker Report - 2026-03-04

## Summary
The QA watcher loop has detected critical regressions and persistent mock provider issues that block multiple E2E gates in Sprint 2.

## Critical Blockers

### 1. UI Hang on Login (HIGH-PRIORITY REGRESSION)
- **Status**: **BLOCKING** `2.16@2FA-1`, `2.5@UPLOAD-1`, `2.5@ACTIONS-1`, `2.8@PREVIEW-1`
- **Description**: After successful API login, the application navigates to `/files` but the UI remains non-interactive. E2E tests time out waiting for the sidebar or user menu.
- **Likely Owner**: ClaudeCode / OpenCode (Auth UI/2FA merge)
- **Failing Suite**: `e2e/2fa.spec.ts`

### 2. Missing IndexedDB Key (Filen Provider)
- **Status**: **BLOCKING** `security-verification-real.spec.ts`
- **Description**: The Filen mock provider (`filen:qa-tester@filen.io:root`) is not correctly caching keys in IndexedDB, while Google and Dropbox work as expected.
- **Likely Owner**: OpenCode (Filen Provider Adapter / Cache Layer)
- **Failing Suite**: `e2e/security-verification-real.spec.ts`

### 3. Favorites API Timeout
- **Status**: **BLOCKING** `phase5-power-user.spec.ts`
- **Description**: Timeout waiting for `/favorites` API call, likely linked to mock provider data inconsistency or UI hang.
- **Likely Owner**: OpenCode
- **Failing Suite**: `e2e/phase5-power-user.spec.ts`

## Dependency Unlock Detection
- **2.2@UPLOAD-1** is **DONE** -> `2.5@UPLOAD-1` is UNBLOCKED (Pending UI Hang Fix).
- **2.13@2FA-1** is **DONE** -> `2.16@2FA-1` is UNBLOCKED (Pending UI Hang Fix).
- **UI-P1-T02/T04/T05** are **DONE** -> UI stability baseline is improving, but major regression in login flow remains.

## Gemini E2E Task Status
- `2.5@UPLOAD-1`: **CLAIMED** (Running) - BLOCKED by UI Hang.
- `2.8@PREVIEW-1`: **CLAIMED** (Running) - BLOCKED by UI Hang.
- `2.16@2FA-1`: **CLAIMED** (Running) - BLOCKED by UI Hang.
- `3.4@TRANSFER-1`: **CLAIMED** (Running) - Partially unblocked by BullMQ merge.
