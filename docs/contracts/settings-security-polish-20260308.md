# Settings And Security Polish

Date: 2026-03-08

## Scope

Refresh the settings and security surfaces using the current CacheFlow shell language without changing backend contracts or the 2FA endpoint flow.

## Included

- Update `/settings` to use the current shell framing and operational summary treatment.
- Rebuild `SettingsPanel` into denser cards using existing local-only settings state.
- Update `/settings/security` page framing to match the current shell.
- Restyle `TwoFAPanel` while preserving:
  - existing API routes
  - existing button copy used by tests
  - `cf-2fa-panel`

## Explicitly Not Included

- No auth model changes
- No provider credential changes
- No new backend settings persistence
- No billing/team/API-key/security-score features

## Verification

- `cd web && npx tsc --noEmit`
- Focused Playwright:
  - `e2e/settingsSurface.spec.ts`
  - `e2e/2fa.spec.ts`
