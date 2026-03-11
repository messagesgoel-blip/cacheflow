# URM-66

## Scope

Implementation of APP-02, APP-05, and APP-08 from `docs/live-e2e-triage-matrix.md`:

- `APP-02`: Add `data-transfer-tray` attribute to TransferTray component, keeping it mounted in the shell layout so it survives navigation
- `APP-05`: Surface 429 rate-limit state in UI with amber indicator and Retry-After countdown
- `APP-08`: Add explicit empty-state components for /trash and /transfers

## Changes

### APP-02: Transfer Tray Data Attribute

- Updated `web/components/transfers/TransferTray.tsx` to add `data-transfer-tray` attribute to all three render states:
  - Collapsed button (no active transfers)
  - Collapsed button with badge (has active transfers)
  - Expanded tray
- The TransferTray was already mounted in `web/app/layout.tsx` via the TransferProvider, so it survives navigation

### APP-05: 429 Rate Limit UI

- Updated `web/context/TransferContext.tsx` to:
  - Add `rateLimited` and `retryAfter` state variables
  - Add `handleRateLimit()` function to detect 429 responses and parse Retry-After header
  - Check for rate limiting in `startTransfer()` and `refreshTransfers()` functions
  - Auto-clear rate limit after the retry interval
  - Expose `rateLimited`, `retryAfter`, and `clearRateLimit` via context value
- Updated `web/components/transfers/TransferTray.tsx` to:
  - Use rate limit state from context
  - Add countdown timer for Retry-After display
  - Show amber indicator in expanded tray header
  - Show amber indicator on collapsed button with badge

### APP-08: Empty State Components

- Created `web/components/EmptyState.tsx` - reusable empty state component with icon, title, description, and optional action props
- Updated `web/app/trash/page.tsx` to use the EmptyState component for the trash empty state
- Created `web/app/transfers/page.tsx` - new transfers history page with:
  - Display of active and completed transfers
  - Empty state using the EmptyState component
  - Retry and dismiss actions for failed transfers

## Verification

- `cd web && npx tsc --noEmit` - TypeScript compilation check
- Visual verification:
  - Transfer tray displays with `data-transfer-tray` attribute
  - Rate limit indicator appears amber when rate limited
  - Trash page shows EmptyState component when trash is empty
  - Transfers page shows EmptyState component when no transfers exist

## Result

- Transfer tray is now identifiable via `data-transfer-tray` attribute in all render states
- 429 rate limit state is surfaced in UI with amber (#f59e0b) indicator and countdown timer
- Reusable EmptyState component is available for future use
- /trash and /transfers pages now have explicit empty state components