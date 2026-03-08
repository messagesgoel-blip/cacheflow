# Dashboard Onboarding Checklist

Date: 2026-03-08

Goal:
- borrow the example UI onboarding checklist pattern using only real CacheFlow milestones and existing routes

Scope:
- add a dashboard checklist for:
  - connect a provider
  - upload the first file
  - run a transfer
  - enable 2FA
- persist frontend milestone completion in local storage
- mark upload and transfer milestones from the existing UI action paths
- read 2FA state from the existing `/api/auth/2fa/status` route

Non-goals:
- no team invites
- no billing or subscription UI
- no backend schema or contract changes

Validation:
- focused Playwright verifies the dashboard checklist state and CTA routing
