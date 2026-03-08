## Task

Settings and preferences form cleanup.

## Scope

- Refined `web/components/SettingsPanel.tsx` with a denser posture summary and tighter top-level control grouping.
- Updated `web/app/settings/page.tsx` to better frame session-safe preference constraints and link security controls from the profile rail.
- Polished `web/app/settings/security/page.tsx` for visual consistency with the main settings shell while preserving the existing 2FA flow and routes.

## Validation

- `cd /opt/docker/apps/cacheflow/web && npx tsc --noEmit`
- `cd /opt/docker/apps/cacheflow/web && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3049 npx playwright test e2e/settingsSurface.spec.ts e2e/2fa.spec.ts`
