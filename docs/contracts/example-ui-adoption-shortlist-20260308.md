# Example UI Adoption Shortlist

Date: 2026-03-08

Source reference:
- `/srv/storage/local/Cacheflow/Roadmap/Example UI`

Goal:
- borrow visual patterns from the example UI without introducing backend dependency drift
- keep CacheFlow aligned with the current roadmap and existing provider model

## Safe To Borrow Now

These are styling and layout upgrades that fit current CacheFlow behavior:

- Shell structure
  - apply the tighter sidebar/header rhythm from:
    - `/srv/storage/local/Cacheflow/Roadmap/Example UI/components/dashboard/app-sidebar.tsx`
    - `/srv/storage/local/Cacheflow/Roadmap/Example UI/components/dashboard/dashboard-header.tsx`
  - target CacheFlow files:
    - `web/components/Sidebar.tsx`
    - `web/components/Navbar.tsx`
    - `web/components/UnifiedBreadcrumb.tsx`

- File browser presentation
  - borrow denser toolbar spacing, provider-dot treatment, compact row spacing, and cleaner list/grid controls from:
    - `/srv/storage/local/Cacheflow/Roadmap/Example UI/components/dashboard/storage-explorer.tsx`
  - target CacheFlow files:
    - `web/components/UnifiedFileBrowser.tsx`
    - `web/components/SelectionToolbar.tsx`

- Transfer presentation
  - borrow summary-stat card layout and active/completed progress-card visual treatment from:
    - `/srv/storage/local/Cacheflow/Roadmap/Example UI/components/dashboard/transfers-view.tsx`
  - target CacheFlow files:
    - `web/components/TransferQueuePanel.tsx`
    - `web/components/TransferModal.tsx`

- Activity feed presentation
  - borrow the timeline/card treatment from:
    - `/srv/storage/local/Cacheflow/Roadmap/Example UI/components/dashboard/activity-log.tsx`
  - target CacheFlow files:
    - `web/components/ActivityFeed.tsx`

- Settings/security card layout
  - borrow tab/card segmentation and visual hierarchy, not the mock product features, from:
    - `/srv/storage/local/Cacheflow/Roadmap/Example UI/components/dashboard/settings-view.tsx`
    - `/srv/storage/local/Cacheflow/Roadmap/Example UI/components/dashboard/security-view.tsx`
  - target CacheFlow files:
    - `web/app/settings/page.tsx`
    - `web/components/SettingsPanel.tsx`
    - `web/app/security/page.tsx`
    - `web/components/settings/TwoFAPanel.tsx`

## Borrow With Minor Wiring

These fit the current product with small frontend integration work:

- Command palette
  - source:
    - `/srv/storage/local/Cacheflow/Roadmap/Example UI/components/dashboard/command-palette.tsx`
  - allowed scope:
    - navigate to existing pages
    - trigger existing actions like upload, connect provider, new folder
  - avoid turning it into a global backend search feature

- Provider card refinement
  - source:
    - `/srv/storage/local/Cacheflow/Roadmap/Example UI/components/dashboard/providers-view.tsx`
  - map only to real CacheFlow fields:
    - label
    - status
    - quota when present
    - host/port/username for VPS
    - last verified / fingerprint state
  - target CacheFlow files:
    - `web/components/ProviderHub.tsx`
    - `web/components/modals/VPSModal.tsx`

- Onboarding checklist
  - source:
    - `/srv/storage/local/Cacheflow/Roadmap/Example UI/components/dashboard/quick-actions.tsx`
  - use only real CacheFlow milestones:
    - connect provider
    - upload file
    - run transfer
    - enable 2FA
  - do not imply unsupported team or billing flows

- Transfer tabs with scheduled linkage
  - source:
    - `/srv/storage/local/Cacheflow/Roadmap/Example UI/components/dashboard/transfers-view.tsx`
  - feasible because CacheFlow already has:
    - transfer UI/state
    - schedules page in `web/app/schedules/page.tsx`

## Do Not Add From Example

These are off-roadmap, misleading, or unsupported by current APIs:

- Billing UI, plan management, subscription framing
- Team invites and team-member management
- API key management as a first-class product area
- Estimated cloud-cost analytics
- AI file categorization controls
- Auto-distribution / provider placement policy controls
- Fake provider object-store metrics:
  - buckets
  - object counts
  - IAM role / service principal summaries
  - egress dashboards
- Security score dashboards and mock enterprise posture metrics

## Non-Aligned With CacheFlow Codebase

Avoid direct code import of:

- the example app's `shadcn/radix` component surface as a new parallel UI system
- CloudBridge branding/content/copy
- object-storage-first provider assumptions
- mocked data-heavy operational panels without real CacheFlow backing

## Suggested Adoption Order

1. Refresh files/providers/activity using existing CacheFlow components and data.
2. Rework settings/security screens using current routes and real 2FA/settings state.
3. Add a thin command palette only if limited to existing navigation and actions.
4. Revisit transfers/schedules visual merge after current transfer surfaces are consolidated.
