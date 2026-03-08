# Providers, Dashboard, and Schedules Polish

Date: 2026-03-08

Scope:
- tighten provider connection modal shells without changing provider connect flows
- densify dashboard quick-actions and onboarding cards
- compact schedules registry cards and schedule creation modal

What changed:
- restyled `ConnectProviderModal` and `VPSModal` onto the current shell panel language
- reduced spacing and badge weight in `QuickActionsPanel` and `OnboardingChecklist`
- tightened schedules header rhythm, job cards, and create/edit job modal framing

Non-goals:
- no backend/API changes
- no copy changes that would invalidate the focused Playwright assertions
- no route or auth behavior changes

Verification:
- `cd web && npx tsc --noEmit`
- focused Playwright:
  - `e2e/providerModals.spec.ts`
  - `e2e/dashboardQuickActions.spec.ts`
  - `e2e/dashboardChecklist.spec.ts`
  - `e2e/schedulesSurface.spec.ts`
